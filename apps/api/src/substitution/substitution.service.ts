import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  catalog,
  computeEffectiveReadiness,
  computeFidelity,
  computePath,
  IEffectiveReadinessResult,
  IReadinessBreakdown,
  TExclusionKey,
  TPath,
} from '@rathe-arsenal/engine';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { CollectionReadService } from '../collection/collection-read.service';
import { SwapsReconciliationService } from '../swaps/swaps-reconciliation.service';
import { buildCurrentDeckSlots } from '../swaps/build-current-deck-slots';

/**
 * Derived read-time fields that are NOT persisted on the snapshot row
 * but can be recomputed purely from the stored breakdown JSONB.
 */
export interface IDerivedSnapshotFields {
  readonly path: TPath;
  readonly fidelityPercent: number;
}

@Injectable()
export class SubstitutionService {
  private readonly logger = new Logger(SubstitutionService.name);

  constructor(
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDecks: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCards: Repository<DeckCardEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshots: Repository<DeckReadinessSnapshotEntity>,
    private readonly authzService: AuthzService,
    private readonly collectionReadService: CollectionReadService,
    private readonly swapsReconciliationService: SwapsReconciliationService,
  ) {}

  /**
   * The single choke point every recompute path routes through (design
   * §11 "Integration points"): computes fresh readiness, persists the
   * snapshot, then reconciles `swap_suggestion` against the fresh
   * `breakdown.substituted[]` so every caller of this method gets
   * reconciliation "for free" instead of each call site wiring it in
   * separately.
   */
  async computeAndStoreReadiness(
    trackedDeckId: number,
    userId: string,
    excludedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
    approvedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
    manager?: EntityManager,
  ): Promise<DeckReadinessSnapshotEntity> {
    const snapshots = manager ? manager.getRepository(DeckReadinessSnapshotEntity) : this.snapshots;
    const { result, deckCardRows } = await this.runReadiness(
      trackedDeckId,
      userId,
      excludedIdentifiers,
      approvedIdentifiers,
    );

    const snapshot = snapshots.create({
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      breakdown: result.breakdown as unknown as Record<string, unknown>,
      substitutions: result.substitutions as unknown as Record<string, unknown>,
    });

    const saved = await snapshots.save(snapshot);

    await this.swapsReconciliationService.reconcile(
      userId,
      trackedDeckId,
      result.breakdown,
      buildCurrentDeckSlots(deckCardRows),
      manager,
    );

    this.logger.log('Readiness snapshot computed', {
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      exclusionCount: excludedIdentifiers.size,
      approvalCount: approvedIdentifiers.size,
    });

    return saved;
  }

  /**
   * Dry-run flavor of {@link computeAndStoreReadiness} used by the
   * interactive swap editor. Computes a fresh `IEffectiveReadinessResult`
   * with the given exclusion/approval sets without persisting any
   * snapshot and without reconciling `swap_suggestion` -- reconciliation
   * is a persistence side-effect, and this method's whole point is to not
   * persist. Callers that want to persist the result (and reconcile)
   * should use {@link computeAndStoreReadiness} instead.
   */
  async computeReadinessWithExclusions(
    trackedDeckId: number,
    userId: string,
    excludedIdentifiers: ReadonlySet<TExclusionKey>,
    approvedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
  ): Promise<IEffectiveReadinessResult> {
    const { result } = await this.runReadiness(
      trackedDeckId,
      userId,
      excludedIdentifiers,
      approvedIdentifiers,
    );
    return result;
  }

  private async runReadiness(
    trackedDeckId: number,
    userId: string,
    excludedIdentifiers: ReadonlySet<TExclusionKey>,
    approvedIdentifiers: ReadonlySet<TExclusionKey>,
  ): Promise<{ result: IEffectiveReadinessResult; deckCardRows: DeckCardEntity[] }> {
    await this.authzService.assertOwnsTrackedDeck(userId, trackedDeckId);

    const deck = await this.trackedDecks.findOne({
      where: { id: trackedDeckId },
    });

    if (!deck) {
      throw new NotFoundException('Tracked deck not found');
    }

    const deckCardRows = await this.deckCards.find({
      where: { trackedDeckId },
    });

    // Load the effective collection: quantities summed across active sources.
    // CollectionReadService handles source filtering so the inventory map
    // reflects the user's active multi-source collection correctly.
    const inventory = await this.collectionReadService.loadOwned(userId);

    const deckInput = {
      cards: deckCardRows.map((row) => ({
        cardIdentifier: row.cardIdentifier,
        quantity: row.quantity,
        slot: row.slot,
      })),
    };

    const result = computeEffectiveReadiness(
      deckInput,
      inventory,
      catalog,
      undefined,
      excludedIdentifiers,
      approvedIdentifiers,
    );

    return { result, deckCardRows };
  }

  /**
   * Derive `path` and `fidelityPercent` for a snapshot at read time.
   *
   * Both fields are computed by pure engine helpers over the persisted
   * `breakdown` JSONB. Legacy snapshots created before the `path` +
   * `fidelityPercent` fields existed on `IEffectiveReadinessResult` can
   * still be classified this way without any database migration --
   * the JSONB shape of `breakdown` is the source of truth.
   *
   * `totalCards` is the deck-level total (sum of all deck card
   * quantities) the snapshot was computed against. Callers already
   * have this value from the deck cards query.
   */
  deriveSnapshotFields(
    snapshot: DeckReadinessSnapshotEntity,
    totalCards: number,
  ): IDerivedSnapshotFields {
    const breakdown = snapshot.breakdown as unknown as IReadinessBreakdown;
    return {
      path: computePath(breakdown),
      fidelityPercent: computeFidelity(breakdown, totalCards),
    };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  catalog,
  computeEffectiveReadiness,
  computeFidelity,
  computePath,
  IEffectiveReadinessResult,
  IReadinessBreakdown,
  TPath,
} from '@rathe-arsenal/engine';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { CollectionReadService } from '../collection/collection-read.service';

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
  ) {}

  async computeAndStoreReadiness(
    trackedDeckId: number,
    userId: string,
    excludedIdentifiers: ReadonlySet<string> = new Set(),
  ): Promise<DeckReadinessSnapshotEntity> {
    const result = await this.runReadiness(
      trackedDeckId,
      userId,
      excludedIdentifiers,
    );

    const snapshot = this.snapshots.create({
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      breakdown: result.breakdown as unknown as Record<string, unknown>,
      substitutions: result.substitutions as unknown as Record<string, unknown>,
    });

    const saved = await this.snapshots.save(snapshot);

    this.logger.log('Readiness snapshot computed', {
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      exclusionCount: excludedIdentifiers.size,
    });

    return saved;
  }

  /**
   * Dry-run flavor of {@link computeAndStoreReadiness} used by the
   * interactive swap editor (U7). Computes a fresh
   * `IEffectiveReadinessResult` with the given exclusion set without
   * persisting any snapshot. Callers that want to persist the result
   * should use {@link computeAndStoreReadiness} instead.
   */
  async computeReadinessWithExclusions(
    trackedDeckId: number,
    userId: string,
    excludedIdentifiers: ReadonlySet<string>,
  ): Promise<IEffectiveReadinessResult> {
    return this.runReadiness(trackedDeckId, userId, excludedIdentifiers);
  }

  private async runReadiness(
    trackedDeckId: number,
    userId: string,
    excludedIdentifiers: ReadonlySet<string>,
  ): Promise<IEffectiveReadinessResult> {
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

    return computeEffectiveReadiness(
      deckInput,
      inventory,
      catalog,
      undefined,
      excludedIdentifiers,
    );
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

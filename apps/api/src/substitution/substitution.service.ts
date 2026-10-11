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
  TPath,
} from '@rathe-arsenal/engine';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../auth/authz.service';
import { CollectionReadService } from '../collection/collection-read.service';
import { ReplacementsQueryService } from '../replacements/replacements-query.service';

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
    private readonly replacementsQueryService: ReplacementsQueryService,
  ) {}

  async computeAndStoreReadiness(
    trackedDeckId: number,
    userId: string,
    manager?: EntityManager,
  ): Promise<DeckReadinessSnapshotEntity> {
    const snapshots = manager ? manager.getRepository(DeckReadinessSnapshotEntity) : this.snapshots;
    const result = await this.runReadiness(trackedDeckId, userId, manager);

    const snapshot = snapshots.create({
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
      breakdown: result.breakdown as unknown as Record<string, unknown>,
      substitutions: result.substitutions as unknown as Record<string, unknown>,
    });

    const saved = await snapshots.save(snapshot);

    this.logger.log('Readiness snapshot computed', {
      trackedDeckId,
      rawPercent: result.rawPercent,
      effectivePercent: result.effectivePercent,
    });

    return saved;
  }

  /** {@link computeAndStoreReadiness} without persisting a snapshot, for a decision that needs fresh numbers. */
  async computeReadiness(
    trackedDeckId: number,
    userId: string,
    manager?: EntityManager,
  ): Promise<IEffectiveReadinessResult> {
    return this.runReadiness(trackedDeckId, userId, manager);
  }

  /**
   * Reads the deck, its cards and its active replacements through `manager`
   * when one is passed: a pick, revert or keep rewrites `deck_card` inside its
   * transaction, and a read through the injected repositories would still see
   * the deck as it was before that write.
   */
  private async runReadiness(
    trackedDeckId: number,
    userId: string,
    manager?: EntityManager,
  ): Promise<IEffectiveReadinessResult> {
    await this.authzService.assertOwnsTrackedDeck(userId, trackedDeckId);

    const trackedDecks = manager ? manager.getRepository(TrackedDeckEntity) : this.trackedDecks;
    const deckCards = manager ? manager.getRepository(DeckCardEntity) : this.deckCards;

    const deck = await trackedDecks.findOne({
      where: { id: trackedDeckId },
    });

    if (!deck) {
      throw new NotFoundException('Tracked deck not found');
    }

    const deckCardRows = await deckCards.find({
      where: { trackedDeckId },
    });

    const protectedCopies = await this.replacementsQueryService.loadProtectedCopies(trackedDeckId, manager);

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

    return computeEffectiveReadiness(deckInput, inventory, catalog, undefined, protectedCopies);
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

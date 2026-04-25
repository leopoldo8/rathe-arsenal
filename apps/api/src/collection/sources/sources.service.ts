import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface IPatchSourceOptions {
  readonly active?: boolean;
  readonly label?: string;
}

export interface IAffectedDeck {
  readonly id: number;
  readonly name: string;
  /** effectivePercent from the latest snapshot before deletion. */
  readonly currentEffectivePercent: number;
}

export interface IPreviewDeleteResult {
  readonly cardsRemoved: number;
  readonly affectedDecks: readonly IAffectedDeck[];
}

export interface IDeleteSourceResult {
  readonly deleted: true;
  readonly recomputeWarning?: boolean;
}

/**
 * Manages `csv_source` rows. Owns the lifecycle of both `kind='manual'` and
 * `kind='csv'` sources. Every write to `collection_card` calls
 * `ensureManualSource` so the manual source exists before the card row is
 * inserted.
 *
 * Design: `ensureManualSource` is idempotent — two concurrent calls for the
 * same user will resolve to the same row because:
 * 1. The first call succeeds (INSERT) or the DB enforces the partial unique
 *    index `(userId) WHERE kind='manual'` and throws a unique-constraint
 *    violation.
 * 2. On constraint violation the catch block re-reads the row within the same
 *    EntityManager context, ensuring the caller participates in the outer tx.
 */
@Injectable()
export class SourcesService {
  private readonly logger = new Logger(SourcesService.name);

  constructor(
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckReadinessSnapshotEntity)
    private readonly snapshotRepo: Repository<DeckReadinessSnapshotEntity>,
    private readonly dataSource: DataSource,
    private readonly decisionsService: DecisionsService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Returns all `kind='csv'` sources for the given user, ordered by
   * `createdAt DESC`.
   */
  async list(userId: string): Promise<CsvSourceEntity[]> {
    return this.csvSourceRepo.find({
      where: { userId, kind: 'csv' },
      order: { createdAt: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /**
   * Updates `active` and/or `label` on a `kind='csv'` source.
   * Calls `assertOwnsCsvSource` first (throws 404 for missing, wrong owner,
   * or `kind='manual'`). After updating, non-fatally recomputes readiness
   * for any affected decks.
   */
  async patch(
    userId: string,
    sourceId: string,
    options: IPatchSourceOptions,
  ): Promise<CsvSourceEntity> {
    await this.assertOwnsCsvSource(userId, sourceId);

    const updatePayload: Partial<Pick<CsvSourceEntity, 'active' | 'label'>> = {};

    if (options.active !== undefined) {
      updatePayload.active = options.active;
    }
    if (options.label !== undefined) {
      updatePayload.label = options.label;
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.csvSourceRepo.update({ id: sourceId }, updatePayload);
    }

    const updated = await this.csvSourceRepo.findOne({ where: { id: sourceId } });
    if (updated === null) {
      throw new NotFoundException('CSV source not found');
    }

    // Non-fatally recompute readiness for all user decks. An active toggle
    // changes which cards are counted, so every deck may be affected.
    if (options.active !== undefined) {
      await this.recomputeReadinessForUser(userId);
    }

    return updated;
  }

  /**
   * Returns a read-only preview of what would be removed if the source were
   * deleted: total `collection_card` rows owned by this source, and the
   * tracked decks that reference any of those card identifiers (with their
   * latest snapshot `effectivePercent`).
   */
  async previewDelete(
    userId: string,
    sourceId: string,
  ): Promise<IPreviewDeleteResult> {
    await this.assertOwnsCsvSource(userId, sourceId);

    // Count cards owned by this source.
    const cardsRemoved = await this.collectionCardRepo.count({
      where: { sourceId },
    });

    // Find card identifiers owned by this source.
    const cards = await this.collectionCardRepo.find({
      where: { sourceId },
      select: ['cardIdentifier'],
    });

    const cardIdentifiers = cards.map((c) => c.cardIdentifier);

    // Find all tracked decks for this user with their latest snapshot.
    const trackedDecks = await this.trackedDeckRepo.find({
      where: { userId },
    });

    const affectedDecks: IAffectedDeck[] = [];

    if (cardIdentifiers.length > 0 && trackedDecks.length > 0) {
      for (const deck of trackedDecks) {
        // Get the latest snapshot for this deck.
        const snapshot = await this.snapshotRepo.findOne({
          where: { trackedDeckId: deck.id },
          order: { computedAt: 'DESC' },
          select: ['effectivePercent', 'substitutions'],
        });

        if (snapshot === null) continue;

        // Check if any card identifiers from this source appear in the deck's
        // substitutions. We check against the snapshot breakdown.
        const breakdown = snapshot.substitutions as Record<string, unknown>;
        const deckCardIds = Object.keys(breakdown);
        const hasOverlap = cardIdentifiers.some((id) => deckCardIds.includes(id));

        if (hasOverlap) {
          affectedDecks.push({
            id: deck.id,
            name: deck.name,
            currentEffectivePercent: snapshot.effectivePercent,
          });
        }
      }
    }

    return { cardsRemoved, affectedDecks };
  }

  /**
   * Cascade-deletes the source and all its `collection_card` rows, then
   * non-fatally recomputes readiness for all user decks.
   * Returns `{ deleted: true, recomputeWarning?: true }`.
   */
  async delete(
    userId: string,
    sourceId: string,
  ): Promise<IDeleteSourceResult> {
    await this.assertOwnsCsvSource(userId, sourceId);

    await this.dataSource.transaction(async (manager: EntityManager) => {
      // Explicit delete of child rows (FK ON DELETE CASCADE also handles this,
      // but explicit is clearer and avoids FK constraint timing edge cases).
      await manager.delete(CollectionCardEntity, { sourceId });
      await manager.delete(CsvSourceEntity, { id: sourceId });
    });

    this.logger.log({ event: 'csv_source.deleted', userId, sourceId });

    const recomputeWarning = await this.recomputeReadinessForUserSafe(userId, sourceId);

    return recomputeWarning
      ? { deleted: true, recomputeWarning: true }
      : { deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Manual source management
  // ---------------------------------------------------------------------------

  /**
   * Returns the `kind='manual'` source for `userId`, creating it if it does
   * not yet exist. Idempotent: two parallel calls for the same user will both
   * resolve to the same row.
   *
   * @param userId - The authenticated user's UUID.
   * @param manager - Optional outer EntityManager when called inside a
   *   transaction (e.g. deck import). Pass it so the find-or-create
   *   participates in the same transaction and cannot be rolled back
   *   independently.
   */
  async ensureManualSource(
    userId: string,
    manager?: EntityManager,
  ): Promise<CsvSourceEntity> {
    const repo = manager
      ? manager.getRepository(CsvSourceEntity)
      : this.csvSourceRepo;

    // Fast path: row already exists.
    const existing = await repo.findOne({
      where: { userId, kind: 'manual' },
    });

    if (existing) {
      return existing;
    }

    // Slow path: insert. On unique-constraint violation (concurrent call),
    // fall back to a re-read.
    try {
      const source = repo.create({
        userId,
        kind: 'manual',
        label: 'Manual entries',
        originalFilename: null,
        sourceUrl: null,
        contentHash: null,
        cardCount: null,
        active: true,
      });

      const saved = await repo.save(source);

      this.logger.log('Manual source created', { userId, sourceId: saved.id });

      return saved;
    } catch (error) {
      // Unique constraint violation means another concurrent caller already
      // inserted the row. Re-read within the same manager so the caller's
      // transaction stays consistent.
      const errorCode = (error as { code?: string }).code;
      if (errorCode === '23505') {
        const refetched = await repo.findOne({
          where: { userId, kind: 'manual' },
        });
        if (refetched) {
          return refetched;
        }
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Authorization helper
  // ---------------------------------------------------------------------------

  /**
   * Asserts that `userId` owns the given `csv_source` and that the source has
   * `kind='csv'` (not `kind='manual'`). Throws `NotFoundException` in all
   * failure cases to prevent enumeration (same 404 for missing, wrong owner,
   * or `kind='manual'`).
   */
  async assertOwnsCsvSource(userId: string, sourceId: string): Promise<void> {
    const source = await this.csvSourceRepo.findOne({
      where: { id: sourceId },
      select: ['id', 'userId', 'kind'],
    });

    if (!source || source.userId !== userId || source.kind !== 'csv') {
      this.logger.warn('AUTHZ_DENIED csv_source', { sourceId, userId });
      throw new NotFoundException('CSV source not found');
    }
  }

  // ---------------------------------------------------------------------------
  // Cross-deck readiness recompute
  // ---------------------------------------------------------------------------

  /**
   * Variant used inside `delete`: returns `true` if any recompute step failed,
   * so the caller can include `recomputeWarning` in the response. All errors
   * are caught and logged non-fatally.
   */
  private async recomputeReadinessForUserSafe(
    userId: string,
    sourceId: string,
  ): Promise<boolean> {
    let hadFailure = false;

    let decks: TrackedDeckEntity[];
    try {
      decks = await this.trackedDeckRepo.find({ where: { userId } });
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to load decks for readiness recompute after source deletion',
        userId,
        sourceId,
        error: (error as Error).message,
      });
      return true;
    }

    for (const deck of decks) {
      try {
        const exclusions = await this.decisionsService.loadExclusions(deck.id);
        await this.substitutionService.computeAndStoreReadiness(
          deck.id,
          userId,
          exclusions,
        );
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to recompute readiness for deck after source deletion',
          userId,
          trackedDeckId: deck.id,
          sourceId,
          error: (error as Error).message,
        });
        hadFailure = true;
      }
    }

    return hadFailure;
  }

  /**
   * Recomputes readiness for every tracked deck owned by `userId`.
   * Failures are logged but do not abort the response. Mirrors the
   * `CsvUploadService.recomputeReadinessForUser` pattern.
   */
  private async recomputeReadinessForUser(userId: string): Promise<void> {
    let decks: TrackedDeckEntity[];
    try {
      decks = await this.trackedDeckRepo.find({ where: { userId } });
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to load decks for readiness recompute after source change',
        userId,
        error: (error as Error).message,
      });
      return;
    }

    for (const deck of decks) {
      try {
        const exclusions = await this.decisionsService.loadExclusions(deck.id);
        await this.substitutionService.computeAndStoreReadiness(
          deck.id,
          userId,
          exclusions,
        );
      } catch (error) {
        this.logger.warn({
          msg: 'Failed to recompute readiness for deck after source change',
          userId,
          trackedDeckId: deck.id,
          error: (error as Error).message,
        });
      }
    }
  }
}

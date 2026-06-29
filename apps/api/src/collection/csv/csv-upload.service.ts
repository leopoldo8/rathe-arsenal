import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { CsvParserService, computeContentHash } from './csv-parser.service';
import { DuplicateDetectionService, computeDelta } from './duplicate-detection.service';
import { nextDedupedLabel } from '../sources/source-label.util';
import { IResolvedCsvRow } from './csv.types';
import { TCsvUploadAction } from './dtos/upload-csv.request.dto';
import {
  IUploadCsvResponse,
  ICreatedResponse,
  IUpdatedResponse,
  IReplacedResponse,
} from './dtos/upload-csv.response.dto';

/**
 * Orchestrates the full CSV upload lifecycle:
 *   parse → detect → (create | update | replace | cancel) → recompute
 *
 * All writes are atomic: the parse and detect phases happen BEFORE the
 * transaction opens. The transaction covers only the actual DB write phase.
 * For `update`, the diff happens inside the transaction to avoid races.
 */
@Injectable()
export class CsvUploadService {
  private readonly logger = new Logger(CsvUploadService.name);

  constructor(
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
    @InjectRepository(TrackedDeckEntity)
    private readonly trackedDeckRepo: Repository<TrackedDeckEntity>,
    @InjectRepository(DeckCardEntity)
    private readonly deckCardRepo: Repository<DeckCardEntity>,
    private readonly dataSource: DataSource,
    private readonly csvParserService: CsvParserService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly decisionsService: DecisionsService,
    private readonly substitutionService: SubstitutionService,
  ) {}

  /**
   * Entry point called from the controller. Dispatches to the appropriate
   * sub-flow based on `action`.
   */
  async handle(
    userId: string,
    buffer: Buffer,
    action: TCsvUploadAction = 'auto',
    targetSourceId?: string,
    originalFilename?: string,
  ): Promise<IUploadCsvResponse> {
    if (action === 'cancel') {
      this.logger.log({ event: 'csv.upload', userId, action, kind: 'cancelled' });
      return { kind: 'cancelled' };
    }

    // Parse is always needed (all non-cancel actions require the buffer).
    const parsed = this.csvParserService.parse(buffer);

    if (action === 'auto') {
      return this.handleAuto(userId, buffer, parsed.resolved, parsed.skipped, originalFilename);
    }

    if (action === 'separate') {
      return this.createNewSource(
        userId,
        buffer,
        parsed.resolved,
        parsed.skipped,
        originalFilename,
      );
    }

    if (action === 'replace') {
      if (targetSourceId === undefined) {
        throw new BadRequestException('MISSING_TARGET_SOURCE');
      }
      await this.assertOwnsCsvSource(userId, targetSourceId);
      return this.replaceSource(userId, targetSourceId, buffer, parsed.resolved, parsed.skipped, originalFilename);
    }

    if (action === 'update') {
      if (targetSourceId === undefined) {
        throw new BadRequestException('MISSING_TARGET_SOURCE');
      }
      await this.assertOwnsCsvSource(userId, targetSourceId);
      return this.updateSource(userId, targetSourceId, buffer, parsed.resolved, parsed.skipped, originalFilename);
    }

    // TypeScript exhaustiveness guard — this branch is unreachable.
    const _exhaustive: never = action;
    throw new BadRequestException(`Unknown action: ${String(_exhaustive)}`);
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  private async handleAuto(
    userId: string,
    buffer: Buffer,
    resolved: readonly IResolvedCsvRow[],
    skipped: readonly import('./csv.types').ISkippedCsvRow[],
    originalFilename?: string,
  ): Promise<IUploadCsvResponse> {
    const resolvedIdSet = new Set(resolved.map((r) => r.cardIdentifier));
    const resolvedQuantities = new Map(resolved.map((r) => [r.cardIdentifier, r.quantity]));
    const hash = computeContentHash(resolved);

    const detection = await this.duplicateDetectionService.detect(
      userId,
      resolvedIdSet,
      resolvedQuantities,
      hash,
    );

    if (detection.kind === 'exact-match') {
      this.logger.log({
        event: 'csv.upload',
        userId,
        action: 'auto',
        kind: 'exact-match',
        cardCount: detection.cardCount,
        skippedCount: skipped.length,
        existingSourceId: detection.existingSourceId,
      });
      return {
        kind: 'exact-match',
        existingSourceId: detection.existingSourceId,
        existingLabel: detection.existingLabel,
        cardCount: detection.cardCount,
        skippedRows: skipped,
      };
    }

    if (detection.kind === 'partial-overlap') {
      this.logger.log({
        event: 'csv.upload',
        userId,
        action: 'auto',
        kind: 'partial-overlap',
        cardCount: detection.cardCount,
        skippedCount: skipped.length,
        existingSourceId: detection.existingSourceId,
      });
      return {
        kind: 'partial-overlap',
        existingSourceId: detection.existingSourceId,
        existingLabel: detection.existingLabel,
        similarityScore: detection.similarityScore,
        delta: detection.delta,
        cardCount: detection.cardCount,
        skippedRows: skipped,
      };
    }

    // detection.kind === 'new'
    return this.createNewSource(userId, buffer, resolved, skipped, originalFilename, 'auto');
  }

  private async createNewSource(
    userId: string,
    buffer: Buffer,
    resolved: readonly IResolvedCsvRow[],
    skipped: readonly import('./csv.types').ISkippedCsvRow[],
    originalFilename?: string,
    action: TCsvUploadAction = 'separate',
  ): Promise<ICreatedResponse> {
    const hash = computeContentHash(resolved);
    const baseLabel = originalFilename ?? 'Imported CSV';

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      const label = await this.dedupeSourceLabel(manager, userId, baseLabel);

      const source = manager.create(CsvSourceEntity, {
        userId,
        kind: 'csv',
        label,
        originalFilename: originalFilename ?? null,
        sourceUrl: null,
        contentHash: hash,
        cardCount: resolved.length,
        active: true,
      });
      const savedSource = await manager.save(CsvSourceEntity, source);

      if (resolved.length > 0) {
        const cardEntities = resolved.map((row) =>
          manager.create(CollectionCardEntity, {
            userId,
            cardIdentifier: row.cardIdentifier,
            sourceId: savedSource.id,
            quantity: row.quantity,
          }),
        );
        await manager.save(CollectionCardEntity, cardEntities);
      }

      return savedSource;
    });

    this.logger.log({
      event: 'csv.upload',
      userId,
      action,
      kind: 'created',
      cardCount: resolved.length,
      skippedCount: skipped.length,
    });

    await this.recomputeReadinessForUser(userId);

    return {
      kind: 'created',
      sourceId: result.id,
      cardCount: resolved.length,
      skippedRows: skipped,
    };
  }

  private async replaceSource(
    userId: string,
    targetSourceId: string,
    buffer: Buffer,
    resolved: readonly IResolvedCsvRow[],
    skipped: readonly import('./csv.types').ISkippedCsvRow[],
    originalFilename?: string,
  ): Promise<IReplacedResponse> {
    const hash = computeContentHash(resolved);
    const label = originalFilename ?? 'Imported CSV';

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      // Delete old cards (FK ON DELETE CASCADE covers it, but explicit delete is safer).
      await manager.delete(CollectionCardEntity, { sourceId: targetSourceId });

      // Delete the old source.
      await manager.delete(CsvSourceEntity, { id: targetSourceId });

      // Create new source.
      const source = manager.create(CsvSourceEntity, {
        userId,
        kind: 'csv',
        label,
        originalFilename: originalFilename ?? null,
        sourceUrl: null,
        contentHash: hash,
        cardCount: resolved.length,
        active: true,
      });
      const savedSource = await manager.save(CsvSourceEntity, source);

      if (resolved.length > 0) {
        const cardEntities = resolved.map((row) =>
          manager.create(CollectionCardEntity, {
            userId,
            cardIdentifier: row.cardIdentifier,
            sourceId: savedSource.id,
            quantity: row.quantity,
          }),
        );
        await manager.save(CollectionCardEntity, cardEntities);
      }

      return savedSource;
    });

    this.logger.log({
      event: 'csv.upload',
      userId,
      action: 'replace',
      kind: 'replaced',
      cardCount: resolved.length,
      skippedCount: skipped.length,
    });

    await this.recomputeReadinessForUser(userId);

    return {
      kind: 'replaced',
      sourceId: result.id,
      cardCount: resolved.length,
      skippedRows: skipped,
    };
  }

  private async updateSource(
    userId: string,
    targetSourceId: string,
    buffer: Buffer,
    resolved: readonly IResolvedCsvRow[],
    skipped: readonly import('./csv.types').ISkippedCsvRow[],
    originalFilename?: string,
  ): Promise<IUpdatedResponse> {
    const hash = computeContentHash(resolved);
    const incomingIdSet = new Set(resolved.map((r) => r.cardIdentifier));
    const incomingQuantities = new Map(resolved.map((r) => [r.cardIdentifier, r.quantity]));

    const result = await this.dataSource.transaction(async (manager: EntityManager) => {
      // Read current rows inside the transaction to avoid race conditions.
      const existingCards = await manager.find(CollectionCardEntity, {
        where: { sourceId: targetSourceId },
        select: ['id', 'cardIdentifier', 'quantity'],
      });

      const existingQuantities = new Map(
        existingCards.map((c) => [c.cardIdentifier, c.quantity]),
      );
      const existingById = new Map(
        existingCards.map((c) => [c.cardIdentifier, c]),
      );

      // Compute delta for the response.
      const delta = computeDelta(incomingIdSet, incomingQuantities, existingQuantities);

      // 1. Update or insert cards that appear in the incoming set.
      for (const row of resolved) {
        const existing = existingById.get(row.cardIdentifier);
        if (existing !== undefined) {
          // Replace quantity (not sum).
          if (existing.quantity !== row.quantity) {
            await manager.update(
              CollectionCardEntity,
              { id: existing.id },
              { quantity: row.quantity },
            );
          }
        } else {
          const newCard = manager.create(CollectionCardEntity, {
            userId,
            cardIdentifier: row.cardIdentifier,
            sourceId: targetSourceId,
            quantity: row.quantity,
          });
          await manager.save(CollectionCardEntity, newCard);
        }
      }

      // 2. Delete cards that disappeared from the new payload.
      const cardIdsToDelete = existingCards
        .filter((c) => !incomingIdSet.has(c.cardIdentifier))
        .map((c) => c.id);

      if (cardIdsToDelete.length > 0) {
        await manager.delete(CollectionCardEntity, { id: In(cardIdsToDelete) });
      }

      // 3. Update source metadata.
      await manager.update(
        CsvSourceEntity,
        { id: targetSourceId },
        {
          contentHash: hash,
          cardCount: resolved.length,
          originalFilename: originalFilename ?? null,
        },
      );

      return { delta };
    });

    this.logger.log({
      event: 'csv.upload',
      userId,
      action: 'update',
      kind: 'updated',
      cardCount: resolved.length,
      skippedCount: skipped.length,
    });

    await this.recomputeReadinessForUser(userId);

    return {
      kind: 'updated',
      sourceId: targetSourceId,
      cardCount: resolved.length,
      delta: result.delta,
      skippedRows: skipped,
    };
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
  private async assertOwnsCsvSource(
    userId: string,
    sourceId: string,
  ): Promise<void> {
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
  // Label de-duplication
  // ---------------------------------------------------------------------------

  /**
   * Resolves a collision-free label for a new `kind='csv'` source. Reads the
   * user's existing csv source labels inside the caller's transaction so the
   * "#N" counter reflects the committed state. See `nextDedupedLabel`.
   */
  private async dedupeSourceLabel(
    manager: EntityManager,
    userId: string,
    baseLabel: string,
  ): Promise<string> {
    const existing = await manager.find(CsvSourceEntity, {
      where: { userId, kind: 'csv' },
      select: { label: true },
    });

    const existingLabels = (existing ?? [])
      .map((s) => s.label)
      .filter((l): l is string => typeof l === 'string' && l.length > 0);

    return nextDedupedLabel(baseLabel, existingLabels);
  }

  // ---------------------------------------------------------------------------
  // Cross-deck readiness recompute
  // ---------------------------------------------------------------------------

  /**
   * Recomputes readiness for every tracked deck owned by `userId`.
   * Failures are logged but do not abort the response — the DB write is already
   * committed. Mirrors the `CollectionService.addCard` pattern.
   */
  private async recomputeReadinessForUser(userId: string): Promise<void> {
    let decks: TrackedDeckEntity[];
    try {
      decks = await this.trackedDeckRepo.find({ where: { userId } });
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to load decks for readiness recompute after CSV upload',
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
          msg: 'Failed to recompute readiness for deck after CSV upload',
          userId,
          trackedDeckId: deck.id,
          error: (error as Error).message,
        });
      }
    }
  }
}

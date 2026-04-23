import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import {
  ICardQuantityChange,
  ICardQuantityEntry,
  ICsvDelta,
  TDuplicateDetectionResult,
} from './csv.types';
import { JACCARD_THRESHOLD } from './jaccard-threshold';

/**
 * Detects whether an incoming parsed CSV is an exact duplicate, a partial
 * overlap, or a completely new source relative to the user's existing active
 * `kind='csv'` sources.
 *
 * Detection strategy:
 * 1. If any existing source has the same `contentHash` → `exact-match`.
 * 2. Else compute Jaccard similarity of the incoming identifier set versus
 *    each existing source's identifier set. If the best score ≥
 *    `JACCARD_THRESHOLD` → `partial-overlap` with delta.
 * 3. Otherwise → `new`.
 *
 * No mutations occur in this service; it is read-only.
 */
@Injectable()
export class DuplicateDetectionService {
  private readonly logger = new Logger(DuplicateDetectionService.name);

  constructor(
    @InjectRepository(CsvSourceEntity)
    private readonly csvSourceRepo: Repository<CsvSourceEntity>,
    @InjectRepository(CollectionCardEntity)
    private readonly collectionCardRepo: Repository<CollectionCardEntity>,
  ) {}

  /**
   * Runs the three-tier duplicate check.
   *
   * @param userId            - The authenticated user's UUID.
   * @param resolvedIdSet     - Set of cardIdentifiers in the incoming CSV.
   * @param resolvedQuantities - Map of cardIdentifier → quantity for the
   *                            incoming CSV (used for delta computation).
   * @param hash              - SHA-256 content hash of the incoming CSV
   *                            (from `computeContentHash`).
   */
  async detect(
    userId: string,
    resolvedIdSet: ReadonlySet<string>,
    resolvedQuantities: ReadonlyMap<string, number>,
    hash: string,
  ): Promise<TDuplicateDetectionResult> {
    // Fetch all active csv sources for this user.
    const sources = await this.csvSourceRepo.find({
      where: { userId, kind: 'csv', active: true },
    });

    if (sources.length === 0) {
      this.logger.log({ event: 'csv.detect', userId, kind: 'new', reason: 'no-existing-sources' });
      return { kind: 'new' };
    }

    // Fetch all collection_card rows belonging to these sources.
    const sourceIds = sources.map((s) => s.id);
    const allCards = await this.loadCardsForSources(sourceIds);

    // Build per-source maps: sourceId → { idSet, quantities }.
    const sourceData = this.buildSourceData(allCards);

    // --- Tier 1: exact hash match ---
    for (const source of sources) {
      if (source.contentHash !== null && source.contentHash === hash) {
        const data = sourceData.get(source.id);
        const cardCount = data !== undefined ? data.idSet.size : 0;

        this.logger.log({
          event: 'csv.detect',
          userId,
          kind: 'exact-match',
          existingSourceId: source.id,
        });

        return {
          kind: 'exact-match',
          existingSourceId: source.id,
          existingLabel: source.label,
          cardCount,
        };
      }
    }

    // --- Tier 2: Jaccard similarity ---
    let bestScore = -1;
    let bestSource: CsvSourceEntity | null = null;

    for (const source of sources) {
      const data = sourceData.get(source.id);
      const existingSet = data !== undefined ? data.idSet : new Set<string>();
      const score = computeJaccard(resolvedIdSet, existingSet);

      if (score > bestScore) {
        bestScore = score;
        bestSource = source;
      }
    }

    if (bestScore >= JACCARD_THRESHOLD && bestSource !== null) {
      const bestData = sourceData.get(bestSource.id);
      const existingQuantities =
        bestData !== undefined ? bestData.quantities : new Map<string, number>();

      const delta = computeDelta(resolvedIdSet, resolvedQuantities, existingQuantities);

      this.logger.log({
        event: 'csv.detect',
        userId,
        kind: 'partial-overlap',
        existingSourceId: bestSource.id,
        score: bestScore,
      });

      return {
        kind: 'partial-overlap',
        existingSourceId: bestSource.id,
        existingLabel: bestSource.label,
        similarityScore: bestScore,
        cardCount: bestData !== undefined ? bestData.idSet.size : 0,
        delta,
      };
    }

    // --- Tier 3: new ---
    this.logger.log({
      event: 'csv.detect',
      userId,
      kind: 'new',
      bestScore,
    });

    return { kind: 'new' };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async loadCardsForSources(
    sourceIds: string[],
  ): Promise<CollectionCardEntity[]> {
    if (sourceIds.length === 0) return [];

    // TypeORM `In` operator requires at least one value; guard above covers it.
    return this.collectionCardRepo.find({
      where: { sourceId: In(sourceIds) },
      select: ['sourceId', 'cardIdentifier', 'quantity'],
    });
  }

  /**
   * Groups collection card rows by sourceId into per-source identifier sets
   * and quantity maps.
   */
  private buildSourceData(
    cards: CollectionCardEntity[],
  ): Map<string, { idSet: Set<string>; quantities: Map<string, number> }> {
    const result = new Map<
      string,
      { idSet: Set<string>; quantities: Map<string, number> }
    >();

    for (const card of cards) {
      let entry = result.get(card.sourceId);
      if (entry === undefined) {
        entry = { idSet: new Set(), quantities: new Map() };
        result.set(card.sourceId, entry);
      }
      entry.idSet.add(card.cardIdentifier);
      entry.quantities.set(card.cardIdentifier, card.quantity);
    }

    return result;
  }
}

// ---------------------------------------------------------------------------
// Pure computation helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Computes the Jaccard similarity coefficient between two identifier sets.
 *
 * Jaccard = |intersection| / |union|
 *
 * Returns 0 when both sets are empty (no meaningful similarity).
 */
export function computeJaccard(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionSize = 0;
  for (const id of a) {
    if (b.has(id)) {
      intersectionSize += 1;
    }
  }

  const unionSize = a.size + b.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Computes the delta between an incoming resolved set and an existing source's
 * quantities.
 *
 * - `added`     — in incoming, not in existing.
 * - `removed`   — in existing, not in incoming.
 * - `increased` — in both, incoming qty > existing qty.
 * - `decreased` — in both, incoming qty < existing qty.
 */
export function computeDelta(
  incomingIdSet: ReadonlySet<string>,
  incomingQuantities: ReadonlyMap<string, number>,
  existingQuantities: ReadonlyMap<string, number>,
): ICsvDelta {
  const added: ICardQuantityEntry[] = [];
  const increased: ICardQuantityChange[] = [];
  const decreased: ICardQuantityChange[] = [];
  const removed: ICardQuantityEntry[] = [];

  // Cards in incoming: added, increased, or decreased.
  for (const cardIdentifier of incomingIdSet) {
    const incomingQty = incomingQuantities.get(cardIdentifier) ?? 0;
    const existingQty = existingQuantities.get(cardIdentifier);

    if (existingQty === undefined) {
      added.push({ cardIdentifier, quantity: incomingQty });
    } else if (incomingQty > existingQty) {
      increased.push({ cardIdentifier, previousQuantity: existingQty, newQuantity: incomingQty });
    } else if (incomingQty < existingQty) {
      decreased.push({ cardIdentifier, previousQuantity: existingQty, newQuantity: incomingQty });
    }
    // Equal quantity: no change, omit from delta.
  }

  // Cards in existing not in incoming: removed.
  for (const [cardIdentifier, existingQty] of existingQuantities) {
    if (!incomingIdSet.has(cardIdentifier)) {
      removed.push({ cardIdentifier, quantity: existingQty });
    }
  }

  return { added, removed, increased, decreased };
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreStockVariantEntity } from '../database/entities/store-stock-variant.entity';

// Re-export IFetchCard from the shared types file so existing importers
// that point here continue to work until they are migrated.
export { IFetchCard } from './types/fetch-card';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Age threshold for variant data to be considered fresh (1 hour). */
const COOLDOWN_THRESHOLD_MS = 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of the cooldown check for a set of cards.
 */
export interface IFreshCheckResult {
  /** True if ALL cards have variant data fresher than 1 hour. */
  readonly fresh: boolean;
  /** True if a fetch is currently in progress for this deck (legacy field — always false now). */
  readonly inProgress: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Exposes the freshness check used by the variant-fetch controller to decide
 * whether to enqueue a new job.
 *
 * The in-memory progress machinery (progressMap, activeFetchSet, startFetch,
 * getProgress, orchestrateLoop, fetchAndPersistCard) has been removed in
 * Task 12A — that work is now handled by VariantJobProcessorService and
 * the DB-backed VariantFetchQueueService.
 */
@Injectable()
export class VariantFetchService {
  constructor(
    @InjectRepository(StoreStockVariantEntity)
    private readonly variantRepository: Repository<StoreStockVariantEntity>,
  ) {}

  /**
   * Checks whether all given cards have fresh variant data (within 1 hour).
   *
   * @param storeId - The store to check variant data for.
   * @param _deckId - Unused after Task 12A (the activeFetchSet was removed).
   * @param cardIdentifiers - The cards to check.
   */
  async isFreshForDeck(
    storeId: number,
    _deckId: string,
    cardIdentifiers: string[],
  ): Promise<IFreshCheckResult> {
    if (cardIdentifiers.length === 0) {
      return { fresh: true, inProgress: false };
    }

    const cutoffTime = new Date(Date.now() - COOLDOWN_THRESHOLD_MS);

    const freshCount = await this.variantRepository
      .createQueryBuilder('v')
      .select('COUNT(DISTINCT v.cardIdentifier)', 'cnt')
      .where('v.storeId = :storeId', { storeId })
      .andWhere('v.cardIdentifier IN (:...cardIdentifiers)', { cardIdentifiers })
      .andWhere('v.detailFetchedAt > :cutoff', { cutoff: cutoffTime })
      .getRawOne<{ cnt: string }>();

    const freshCardCount = parseInt(freshCount?.cnt ?? '0', 10);
    const fresh = freshCardCount >= cardIdentifiers.length;

    return { fresh, inProgress: false };
  }
}

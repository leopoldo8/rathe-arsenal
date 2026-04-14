import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockVariantEntity } from '../database/entities/store-stock-variant.entity';
import { SbraubleDetailParserService } from './sbrauble-detail-parser.service';
import {
  IVariantFetchProgress,
  TCardFetchStatus,
} from './types/variant-fetch-progress';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum milliseconds between detail-page fetches (from store.rateLimitMs in DB). */
const DEFAULT_RATE_LIMIT_MS = 1_500;

/** Age threshold for variant data to be considered fresh (1 hour). */
const COOLDOWN_THRESHOLD_MS = 60 * 60 * 1_000;

/** Time after fetch completion before the progress entry is removed from the Map. */
const PROGRESS_CLEANUP_DELAY_MS = 5 * 60 * 1_000;

/** Maximum response body size per detail page fetch (5 MB). */
const MAX_BYTES = 5 * 1024 * 1024;

/** Timeout per HTTP request in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum number of entries in the in-memory progress Map (LRU cap). */
const MAX_PROGRESS_MAP_SIZE = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input card record for a single variant fetch operation.
 * Provided by the caller (controller) after resolving store_stock rows.
 */
export interface IFetchCard {
  readonly cardIdentifier: string;
  readonly productUrl: string;
  /** The listing row's priceCents at the time startFetch is called (snapshot). */
  readonly listingPriceCents: number | null;
  /** The listing row's quantity at the time startFetch is called (snapshot). */
  readonly listingQuantity: number;
}

/**
 * Result of the cooldown check for a set of cards.
 */
export interface IFreshCheckResult {
  /** True if ALL cards have variant data fresher than 1 hour. */
  readonly fresh: boolean;
  /** True if a fetch is currently in progress for this deck. */
  readonly inProgress: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Orchestrates detail-page fetching for a set of cards, persisting variant
 * data as each card completes.
 *
 * Key responsibilities:
 * - Coordinate rate limiting via DB (re-read store.lastFetchedAt per card).
 * - Prevent duplicate async loops for the same deck (concurrent-fetch Set).
 * - Persist variant rows atomically per card (upsert + delete-disappeared).
 * - Track progress in-memory keyed by deckId (not fetchId).
 * - Clean up progress entries 5 minutes after completion (LRU capped at 100).
 * - Expose cooldown check (isFreshForDeck) for the POST endpoint.
 */
@Injectable()
export class VariantFetchService implements OnModuleDestroy {
  private readonly logger = new Logger(VariantFetchService.name);

  /**
   * Set of deckIds currently being fetched.
   * Prevents duplicate async loops on double-click.
   */
  private readonly activeFetchSet = new Set<string>();

  /**
   * In-memory progress tracker keyed by deckId.
   * Allows GET /decks/:deckId to look up progress without fetchId round-trip.
   */
  private readonly progressMap = new Map<string, IVariantFetchProgress>();

  /**
   * Cleanup timers keyed by deckId.
   * Cleared in onModuleDestroy to prevent dangling timers in tests.
   */
  private readonly cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly fetchGuard: FetchGuardService,
    private readonly parser: SbraubleDetailParserService,
    @InjectRepository(StoreEntity)
    private readonly storeRepository: Repository<StoreEntity>,
    @InjectRepository(StoreStockVariantEntity)
    private readonly variantRepository: Repository<StoreStockVariantEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.cleanupTimers.values()) {
      globalThis.clearTimeout(timer);
    }
    this.cleanupTimers.clear();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Starts an async detail-page fetch for the given deck's cards.
   *
   * If a fetch is already active for this deck, returns the existing fetchId
   * without spawning a duplicate loop.
   *
   * @returns The fetchId for client-side correlation.
   */
  startFetch(
    deckId: string,
    storeId: number,
    cards: IFetchCard[],
  ): string {
    const existingProgress = this.progressMap.get(deckId);
    if (this.activeFetchSet.has(deckId) && existingProgress) {
      this.logger.log({
        msg: 'Variant fetch already active for deck — returning existing fetchId',
        deckId,
        fetchId: existingProgress.fetchId,
      });
      return existingProgress.fetchId;
    }

    const fetchId = randomUUID();
    const cardStatusMap = new Map<string, TCardFetchStatus>(
      cards.map((c) => [c.cardIdentifier, 'pending']),
    );

    const progress: IVariantFetchProgress = {
      fetchId,
      total: cards.length,
      completed: 0,
      failed: 0,
      inProgress: true,
      startedAt: new Date(),
      cards: cardStatusMap,
      globalFailed: false,
    };

    this.evictLruEntries();
    this.progressMap.set(deckId, progress);
    this.activeFetchSet.add(deckId);

    // Fire-and-forget: belt-and-suspenders .catch in case the top-level
    // try/catch inside orchestrateLoop somehow misses a rejection.
    this.orchestrateLoop(deckId, storeId, cards, progress).catch((err: unknown) => {
      this.logger.error({
        msg: 'Unhandled rejection escaped orchestrateLoop — this should not happen',
        deckId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return fetchId;
  }

  /**
   * Returns the current progress for a deck, or undefined if no fetch
   * has been started (or the progress entry has already been cleaned up).
   */
  getProgress(deckId: string): IVariantFetchProgress | undefined {
    return this.progressMap.get(deckId);
  }

  /**
   * Checks whether all given cards have fresh variant data (within 1 hour)
   * and whether a fetch is currently in progress for this deck.
   *
   * @param storeId - The store to check variant data for.
   * @param deckId - Used to check the concurrent-fetch Set.
   * @param cardIdentifiers - The cards to check.
   */
  async isFreshForDeck(
    storeId: number,
    deckId: string,
    cardIdentifiers: string[],
  ): Promise<IFreshCheckResult> {
    const inProgress = this.activeFetchSet.has(deckId);

    if (cardIdentifiers.length === 0) {
      return { fresh: true, inProgress };
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

    return { fresh, inProgress };
  }

  // ---------------------------------------------------------------------------
  // Orchestration loop
  // ---------------------------------------------------------------------------

  /**
   * Main orchestration loop. Fetches detail pages one-by-one,
   * persisting variants atomically per card.
   *
   * Wrapped in try/catch/finally for unhandled-rejection safety.
   * Per-card failures log and continue; only catastrophic errors
   * (e.g., DB connection drop) set globalFailed.
   */
  private async orchestrateLoop(
    deckId: string,
    storeId: number,
    cards: IFetchCard[],
    progress: IVariantFetchProgress,
  ): Promise<void> {
    try {
      const store = await this.storeRepository.findOne({ where: { id: storeId } });
      if (!store) {
        throw new Error(`Store not found: storeId=${storeId}`);
      }

      const storeHostname = new URL(store.baseUrl).hostname;

      for (const card of cards) {
        try {
          await this.fetchAndPersistCard(store, storeHostname, storeId, card, progress);
        } catch (cardErr) {
          // Per-card failure: log, mark failed, continue loop
          this.logger.error({
            msg: 'Card variant fetch failed',
            deckId,
            cardIdentifier: card.cardIdentifier,
            error: cardErr instanceof Error ? cardErr.message : String(cardErr),
          });
          progress.cards.set(card.cardIdentifier, 'failed');
          progress.failed += 1;
        }
      }
    } catch (loopErr) {
      // Catastrophic failure (e.g., DB connection drop): mark globalFailed
      progress.globalFailed = true;
      this.logger.error({
        msg: 'Variant fetch orchestration loop failed catastrophically',
        deckId,
        error: loopErr instanceof Error ? loopErr.message : String(loopErr),
      });
    } finally {
      progress.inProgress = false;
      this.activeFetchSet.delete(deckId);
      this.scheduleProgressCleanup(deckId);

      this.logger.log({
        msg: 'Variant fetch loop completed',
        deckId,
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        globalFailed: progress.globalFailed,
      });
    }
  }

  /**
   * Fetches the detail page for a single card and persists variant rows.
   *
   * Steps:
   * 1. Re-read store.lastFetchedAt from DB and enforce rate limit.
   * 2. Fetch detail page via FetchGuardService.
   * 3. Persist now to store.lastFetchedAt in DB.
   * 4. Parse variants.
   * 5. Upsert + delete-disappeared atomically in a transaction.
   * 6. Update progress tracker.
   */
  private async fetchAndPersistCard(
    store: StoreEntity,
    storeHostname: string,
    storeId: number,
    card: IFetchCard,
    progress: IVariantFetchProgress,
  ): Promise<void> {
    // Step 1: re-read lastFetchedAt from DB (coordinate with bulk scrape)
    const freshStore = await this.storeRepository.findOne({ where: { id: storeId } });
    const lastFetchedAt = freshStore?.lastFetchedAt ?? null;
    const rateLimitMs = freshStore?.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;

    if (lastFetchedAt !== null) {
      const elapsed = Date.now() - lastFetchedAt.getTime();
      const remaining = Math.max(0, rateLimitMs - elapsed);
      if (remaining > 0) {
        this.logger.debug({
          msg: 'Rate limiting detail fetch',
          cardIdentifier: card.cardIdentifier,
          remainingMs: remaining,
          storeSlug: store.slug,
        });
        await sleep(remaining);
      }
    }

    // Step 2: fetch detail page
    const result = await this.fetchGuard.guardedFetch(card.productUrl, {
      allowHosts: [storeHostname],
      maxBytes: MAX_BYTES,
      timeoutMs: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RatheArsenal/1.0)',
        Accept: 'text/html',
      },
    });

    const html = Buffer.from(result.body).toString('utf-8');

    // Step 3: persist lastFetchedAt to DB immediately after fetch
    const now = new Date();
    await this.storeRepository.update({ id: storeId }, { lastFetchedAt: now });

    // Step 4: parse variants
    const scrapedVariants = this.parser.parseDetailPage(html);

    // Step 5: upsert + delete-disappeared atomically
    await this.dataSource.transaction(async (em) => {
      if (scrapedVariants.length > 0) {
        const values = scrapedVariants.map((v) => ({
          storeId,
          cardIdentifier: card.cardIdentifier,
          edition: v.edition,
          condition: v.condition,
          finish: v.finish,
          priceCents: v.priceCents,
          quantity: v.quantity,
          detailFetchedAt: now,
          listingPriceCentsSnapshot: card.listingPriceCents,
          listingQuantitySnapshot: card.listingQuantity,
        }));

        await em
          .createQueryBuilder()
          .insert()
          .into(StoreStockVariantEntity)
          .values(values)
          .orUpdate(
            [
              'priceCents',
              'quantity',
              'detailFetchedAt',
              'listingPriceCentsSnapshot',
              'listingQuantitySnapshot',
            ],
            ['storeId', 'cardIdentifier', 'edition', 'condition', 'finish'],
          )
          .execute();
      }

      // Delete variant rows that no longer appear on the detail page
      const currentEditionConditionFinishes = scrapedVariants.map(
        (v) => `${v.edition}|||${v.condition}|||${v.finish}`,
      );

      if (currentEditionConditionFinishes.length > 0) {
        // Delete rows for this card that don't match any current variant
        const existingVariants = await em
          .getRepository(StoreStockVariantEntity)
          .find({ where: { storeId, cardIdentifier: card.cardIdentifier } });

        const toDelete = existingVariants.filter((row) => {
          const key = `${row.edition}|||${row.condition}|||${row.finish}`;
          return !currentEditionConditionFinishes.includes(key);
        });

        if (toDelete.length > 0) {
          const idsToDelete = toDelete.map((r) => r.id);
          await em
            .getRepository(StoreStockVariantEntity)
            .delete(idsToDelete);
        }
      } else {
        // Zero variants on the page: delete ALL rows for this card
        await em
          .createQueryBuilder()
          .delete()
          .from(StoreStockVariantEntity)
          .where('storeId = :storeId AND cardIdentifier = :cardIdentifier', {
            storeId,
            cardIdentifier: card.cardIdentifier,
          })
          .execute();
      }
    });

    // Step 6: update progress
    progress.cards.set(card.cardIdentifier, 'done');
    progress.completed += 1;

    this.logger.debug({
      msg: 'Card variant fetch completed',
      cardIdentifier: card.cardIdentifier,
      variantCount: scrapedVariants.length,
    });
  }

  // ---------------------------------------------------------------------------
  // Progress management helpers
  // ---------------------------------------------------------------------------

  /**
   * Schedules removal of the progress entry for deckId after PROGRESS_CLEANUP_DELAY_MS.
   * Any previously scheduled timer for this deckId is cleared first.
   */
  private scheduleProgressCleanup(deckId: string): void {
    const existing = this.cleanupTimers.get(deckId);
    if (existing !== undefined) {
      globalThis.clearTimeout(existing);
    }

    const timer = globalThis.setTimeout(() => {
      this.progressMap.delete(deckId);
      this.cleanupTimers.delete(deckId);
    }, PROGRESS_CLEANUP_DELAY_MS);

    this.cleanupTimers.set(deckId, timer);
  }

  /**
   * Enforces the LRU cap on the progress Map.
   * When the map is at or above MAX_PROGRESS_MAP_SIZE, evicts the oldest
   * completed entries first (those where inProgress === false).
   */
  private evictLruEntries(): void {
    if (this.progressMap.size < MAX_PROGRESS_MAP_SIZE) {
      return;
    }

    // Collect completed entries in insertion order (oldest first)
    const completedKeys: string[] = [];
    for (const [key, entry] of this.progressMap.entries()) {
      if (!entry.inProgress) {
        completedKeys.push(key);
      }
    }

    // Evict oldest completed entries until we are below the cap
    for (const key of completedKeys) {
      if (this.progressMap.size < MAX_PROGRESS_MAP_SIZE) {
        break;
      }
      const timer = this.cleanupTimers.get(key);
      if (timer !== undefined) {
        globalThis.clearTimeout(timer);
        this.cleanupTimers.delete(key);
      }
      this.progressMap.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Module-private utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

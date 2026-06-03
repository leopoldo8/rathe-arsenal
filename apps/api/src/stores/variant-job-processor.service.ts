import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { SbraubleDetailParserService } from './sbrauble-detail-parser.service';
import { VariantFetchQueueService } from './variant-fetch-queue.service';
import { StoreEntity } from '../database/entities/store.entity';
import { StoreStockEntity } from '../database/entities/store-stock.entity';
import { StoreStockVariantEntity } from '../database/entities/store-stock-variant.entity';
import { VariantFetchJobEntity } from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './types/fetch-card';
import { deriveStoreStock } from './store-stock-derivation';

// ---------------------------------------------------------------------------
// Constants — match variant-fetch.service.ts
// ---------------------------------------------------------------------------

/** Minimum milliseconds between detail-page fetches when no store value is set. */
const DEFAULT_RATE_LIMIT_MS = 1_500;

/** Maximum response body size per detail page fetch (5 MB). */
const MAX_BYTES = 5 * 1024 * 1024;

/** Timeout per HTTP request in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Processes a single VariantFetchJob: fetches detail pages for each card,
 * persists variant rows (same schema as VariantFetchService.fetchAndPersistCard),
 * derives store_stock from variants, and marks progress via VariantFetchQueueService.
 *
 * This service is the queue-worker counterpart to the original in-process
 * VariantFetchService. It will replace the old service once the queue-based
 * worker is fully wired (Task 12).
 */
@Injectable()
export class VariantJobProcessorService {
  private readonly logger = new Logger(VariantJobProcessorService.name);

  constructor(
    private readonly fetchGuard: FetchGuardService,
    private readonly parser: SbraubleDetailParserService,
    private readonly queue: VariantFetchQueueService,
    @InjectRepository(StoreEntity) private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(StoreStockEntity) private readonly stockRepo: Repository<StoreStockEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Processes a running job by fetching + persisting variants for each card
   * in sequence, then calling queue.finish when all cards are done.
   */
  async process(job: VariantFetchJobEntity, cards: readonly IFetchCard[]): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { id: job.storeId } });
    if (!store) {
      await this.queue.finish(job.id, `store ${job.storeId} not found`);
      return;
    }

    const hostname = new URL(store.baseUrl).hostname;

    for (const card of cards) {
      try {
        await this.fetchAndPersist(store, hostname, card);
        await this.queue.markCardResult(job.id, card.cardIdentifier, true);
      } catch (err) {
        this.logger.warn({
          msg: 'Card variant fetch failed',
          cardIdentifier: card.cardIdentifier,
          error: (err as Error).message,
        });
        await this.queue.markCardResult(job.id, card.cardIdentifier, false);
      }
    }

    await this.queue.finish(job.id, null);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetches the detail page for a single card, writes variant rows in a
   * transaction (upsert + delete-disappeared — identical to
   * VariantFetchService.fetchAndPersistCard), then derives and upserts
   * the store_stock summary row.
   */
  private async fetchAndPersist(
    store: StoreEntity,
    hostname: string,
    card: IFetchCard,
  ): Promise<void> {
    // Step 1: re-read lastFetchedAt from DB (coordinate rate limiting with
    // any concurrent scraper or other worker processing the same store)
    const freshStore = await this.storeRepo.findOne({ where: { id: store.id } });
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
      allowHosts: [hostname],
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
    await this.storeRepo.update({ id: store.id }, { lastFetchedAt: now });

    // Step 4: parse variants
    const scrapedVariants = this.parser.parseDetailPage(html);

    // Step 5: upsert + delete-disappeared atomically — SAME transaction shape
    // as VariantFetchService.fetchAndPersistCard
    await this.dataSource.transaction(async (em) => {
      if (scrapedVariants.length > 0) {
        const values = scrapedVariants.map((v) => ({
          storeId: store.id,
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
          .find({ where: { storeId: store.id, cardIdentifier: card.cardIdentifier } });

        const toDelete = existingVariants.filter((row) => {
          const key = `${row.edition}|||${row.condition}|||${row.finish}`;
          return !currentEditionConditionFinishes.includes(key);
        });

        if (toDelete.length > 0) {
          const idsToDelete = toDelete.map((r) => r.id);
          await em.getRepository(StoreStockVariantEntity).delete(idsToDelete);
        }
      } else {
        // Zero variants on the page: delete ALL rows for this card
        await em
          .createQueryBuilder()
          .delete()
          .from(StoreStockVariantEntity)
          .where('storeId = :storeId AND cardIdentifier = :cardIdentifier', {
            storeId: store.id,
            cardIdentifier: card.cardIdentifier,
          })
          .execute();
      }
    });

    // Step 6: derive + upsert store_stock summary
    // productNameRaw: card.cardIdentifier is used as a safe fallback since
    // IFetchCard does not carry a display name. The field is non-rendered
    // (debug/alias table only) and the canonical identifier is human-readable.
    const derived = deriveStoreStock(scrapedVariants);
    await this.stockRepo.upsert(
      {
        storeId: store.id,
        cardIdentifier: card.cardIdentifier,
        priceCents: derived.priceCents,
        quantity: derived.quantity,
        productUrl: card.productUrl,
        productNameRaw: card.cardIdentifier,
        lastFetchedAt: now,
      },
      ['storeId', 'cardIdentifier'],
    );

    this.logger.debug({
      msg: 'Card variant fetch and store_stock upsert completed',
      cardIdentifier: card.cardIdentifier,
      variantCount: scrapedVariants.length,
      derivedPriceCents: derived.priceCents,
      derivedQuantity: derived.quantity,
    });
  }
}

// ---------------------------------------------------------------------------
// Module-private utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

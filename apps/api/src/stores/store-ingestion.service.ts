import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  EStoreScrapeRunStatus,
} from '../database/entities';
import { CardNameMatcherService } from './card-name-matcher.service';
import { SbraubleScraperService } from './sbrauble-scraper.service';

/**
 * Duration in milliseconds after which a `running` scrape-run row is
 * considered stale (soft lock expiry). Prevents a crashed pod from blocking
 * all future runs indefinitely.
 */
const SOFT_LOCK_STALE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Delta-guard threshold. If the fraction of existing stock rows that would
 * be changed (upserted or zeroed) exceeds this value, the run is aborted
 * and marked `paused_delta_guard`.
 */
const DELTA_GUARD_THRESHOLD_PCT = 90;

/**
 * Summary returned by every call to `runScrape()`. Suitable for serialising
 * directly to the admin endpoint response.
 */
export interface IScrapeRunSummary {
  readonly runId: number;
  readonly productsFetched: number;
  readonly productsMatched: number;
  readonly productsUnmatched: number;
  readonly rowsUpserted: number;
  readonly rowsZeroed: number;
  readonly deltaPercent: number | null;
  readonly durationMs: number;
  readonly forcedOverride: boolean;
}

/**
 * Summary returned by `runUrlSync()`.
 */
export interface IUrlSyncSummary {
  readonly productsFetched: number;
  readonly productsMatched: number;
  readonly rowsUpserted: number;
}

export type TUrlSyncState = 'idle' | 'queued' | 'running';

export interface IUrlSyncStatus {
  readonly state: TUrlSyncState;
  readonly lastUrlSyncAt: string | null;
  readonly lastProductCount: number | null;
}

/**
 * Structured product record held in the in-memory staging map while iterating
 * the scraper stream.
 */
interface IStagedProduct {
  readonly priceCents: number | null;
  readonly quantity: number;
  readonly productUrl: string;
  readonly productNameRaw: string;
}

/**
 * Orchestrates the full scrape → match → upsert pipeline for a single store.
 *
 * Entry point: `runScrape(storeSlug, options)`.
 *
 * Responsibilities:
 * - Enforce the 30-minute soft lock against concurrent runs.
 * - Enforce the delta-guard lock (paused_delta_guard state requires force=true).
 * - Stage scraped products in memory (de-duplicate by preferring higher quantity,
 *   then lower price on tie).
 * - Compute the delta percentage against the current store_stock state.
 * - Check the 90% delta guard (first-run exemption keyed on completed-run
 *   history, NOT on store_stock being empty).
 * - Persist changes in a single transaction: upsert new/changed rows,
 *   zero-out absent rows.
 * - Finalize the store_scrape_run row and update store.lastScrapedAt.
 * - On any error during the pipeline, mark the run as failed and re-throw.
 *
 * No HTTP calls — all outbound I/O routes through SbraubleScraperService.
 */
@Injectable()
export class StoreIngestionService {
  private readonly logger = new Logger(StoreIngestionService.name);

  constructor(
    @InjectRepository(StoreEntity)
    private readonly storeRepo: Repository<StoreEntity>,
    @InjectRepository(StoreScrapeRunEntity)
    private readonly runRepo: Repository<StoreScrapeRunEntity>,
    @InjectRepository(StoreStockEntity)
    private readonly stockRepo: Repository<StoreStockEntity>,
    private readonly scraper: SbraubleScraperService,
    private readonly matcher: CardNameMatcherService,
    private readonly dataSource: DataSource,
  ) {}

  async runScrape(
    storeSlug: string,
    options: { force?: boolean; actorIp?: string; dryRun?: boolean } = {},
  ): Promise<IScrapeRunSummary> {
    const startedAt = new Date();

    // Step 1: load store
    const store = await this.storeRepo.findOne({ where: { slug: storeSlug } });
    if (!store) {
      throw new NotFoundException(`Store not found: ${storeSlug}`);
    }
    if (!store.active) {
      throw new NotFoundException(`Store is inactive: ${storeSlug}`);
    }

    // Step 2: soft-lock check (concurrent run guard)
    await this.checkSoftLock(store.id);

    // Step 3: delta-guard lock check
    const forcedOverride = await this.checkDeltaGuardLock(store.id, options.force ?? false, options.actorIp);

    // Step 4: create the run row
    const run = await this.runRepo.save(
      this.runRepo.create({
        storeId: store.id,
        startedAt,
        finishedAt: null,
        status: EStoreScrapeRunStatus.Running,
        productsFetched: 0,
        productsMatched: 0,
        productsUnmatched: 0,
        rowsUpserted: 0,
        rowsZeroed: 0,
        deltaPercent: null,
        errorMessage: null,
        forcedOverride,
      }),
    );

    try {
      // Steps 5-9: pipeline
      const summary = await this.executePipeline(store, run, forcedOverride, startedAt, options.dryRun ?? false);
      return summary;
    } catch (err) {
      // Step 10: mark run failed
      await this.runRepo.update(
        { id: run.id },
        {
          status: EStoreScrapeRunStatus.Failed,
          finishedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      );
      throw err;
    }
  }

  /**
   * Runs a lightweight URL/name sync for the given store.
   *
   * Unlike `runScrape`, this method:
   * - Does NOT create a `store_scrape_run` row.
   * - Does NOT run the delta guard.
   * - Does NOT zero out disappeared cards.
   * - Updates ONLY `productUrl` and `productNameRaw` on existing rows, and
   *   inserts new rows with `priceCents: null, quantity: 0`.
   *
   * Existing `priceCents` and `quantity` values are intentionally preserved —
   * the detail-page queue is responsible for keeping them current.
   */
  async runUrlSync(storeSlug: string): Promise<IUrlSyncSummary> {
    const store = await this.storeRepo.findOne({ where: { slug: storeSlug } });
    if (!store) {
      throw new NotFoundException(`Store not found: ${storeSlug}`);
    }
    if (!store.active) {
      throw new NotFoundException(`Store is inactive: ${storeSlug}`);
    }

    let productsFetched = 0;
    let productsMatched = 0;
    let rowsUpserted = 0;
    const now = new Date();

    for await (const product of this.scraper.scrapeStore(store)) {
      productsFetched++;

      const matchResults = await this.matcher.match(store.slug, product.rawName);
      if (matchResults.length === 0) {
        continue;
      }

      productsMatched++;

      for (const { cardIdentifier } of matchResults) {
        const existing = await this.stockRepo.findOne({
          where: { storeId: store.id, cardIdentifier },
        });

        if (existing) {
          // Update only productUrl + productNameRaw; preserve priceCents/quantity.
          await this.stockRepo.update(
            { storeId: store.id, cardIdentifier },
            { productUrl: product.productUrl, productNameRaw: product.rawName },
          );
        } else {
          // New row: insert with sentinel price/stock.
          await this.stockRepo.save(
            this.stockRepo.create({
              storeId: store.id,
              cardIdentifier,
              priceCents: null,
              quantity: 0,
              productUrl: product.productUrl,
              productNameRaw: product.rawName,
              lastFetchedAt: now,
            }),
          );
        }

        rowsUpserted++;
      }
    }

    // Persist the sync timestamp + product count for status display.
    await this.storeRepo.update(
      { id: store.id },
      { lastUrlSyncAt: now, lastUrlSyncProductCount: productsFetched },
    );

    this.logger.log('URL sync completed', {
      storeSlug,
      productsFetched,
      productsMatched,
      rowsUpserted,
    });

    return { productsFetched, productsMatched, rowsUpserted };
  }

  /**
   * Returns the timestamp of the store's last completed URL sync, or null if it
   * has never synced. The worker seeds its in-memory cadence clock from this so
   * redeploys within the sync interval don't re-scrape the whole catalog.
   */
  async getLastUrlSyncAt(storeSlug: string): Promise<Date | null> {
    const store = await this.storeRepo.findOne({
      where: { slug: storeSlug },
      select: ['id', 'lastUrlSyncAt'],
    });
    return store?.lastUrlSyncAt ?? null;
  }

  /**
   * Queues an on-demand URL sync for the store (owner-triggered). The worker
   * picks it up on its next loop. Idempotent: re-requesting just refreshes the
   * timestamp.
   */
  async requestUrlSync(storeSlug: string): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { slug: storeSlug } });
    if (!store) {
      throw new NotFoundException(`Store not found: ${storeSlug}`);
    }
    await this.storeRepo.update({ id: store.id }, { urlSyncRequestedAt: new Date() });
  }

  /**
   * Atomically claims one queued URL sync, if any: clears `urlSyncRequestedAt`
   * and sets `urlSyncRunningAt` (the claim lock that stops the fast worker loop
   * from starting the long sync twice). Returns the store slug to run, or null.
   */
  async claimPendingUrlSync(): Promise<string | null> {
    const result = await this.storeRepo.query(
      `UPDATE store SET "urlSyncRequestedAt" = NULL, "urlSyncRunningAt" = now()
       WHERE id = (
         SELECT id FROM store WHERE "urlSyncRequestedAt" IS NOT NULL AND "urlSyncRunningAt" IS NULL
         ORDER BY "urlSyncRequestedAt" FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING slug`,
    );
    // TypeORM returns `[rows, rowCount]` for UPDATE; unwrap before indexing.
    const rows: Array<{ slug: string }> = Array.isArray(result?.[0]) ? result[0] : result;
    return rows?.[0]?.slug ?? null;
  }

  /** Clears the running lock after a claimed sync finishes (success or failure). */
  async markUrlSyncIdle(storeSlug: string): Promise<void> {
    await this.storeRepo.update({ slug: storeSlug }, { urlSyncRunningAt: null });
  }

  /** Current URL-sync state + last-run summary, for the owner status display. */
  async getUrlSyncStatus(storeSlug: string): Promise<IUrlSyncStatus> {
    const store = await this.storeRepo.findOne({
      where: { slug: storeSlug },
      select: [
        'id',
        'lastUrlSyncAt',
        'lastUrlSyncProductCount',
        'urlSyncRequestedAt',
        'urlSyncRunningAt',
      ],
    });
    if (!store) {
      throw new NotFoundException(`Store not found: ${storeSlug}`);
    }
    const state: TUrlSyncState = store.urlSyncRunningAt
      ? 'running'
      : store.urlSyncRequestedAt
        ? 'queued'
        : 'idle';
    return {
      state,
      lastUrlSyncAt: store.lastUrlSyncAt?.toISOString() ?? null,
      lastProductCount: store.lastUrlSyncProductCount ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Throws if a non-stale `running` row exists for this store.
   * A row older than SOFT_LOCK_STALE_MS is treated as abandoned and ignored.
   */
  private async checkSoftLock(storeId: number): Promise<void> {
    const latestRunning = await this.runRepo.findOne({
      where: { storeId, status: EStoreScrapeRunStatus.Running },
      order: { startedAt: 'DESC' },
    });

    if (!latestRunning) return;

    const ageMs = Date.now() - latestRunning.startedAt.getTime();
    if (ageMs < SOFT_LOCK_STALE_MS) {
      throw new ConflictException(
        `SCRAPE_ALREADY_RUNNING: storeId=${storeId} runId=${latestRunning.id} startedAt=${latestRunning.startedAt.toISOString()}`,
      );
    }

    // Stale lock — log and continue
    this.logger.warn('Stale running row detected — treating as abandoned', {
      storeId,
      runId: latestRunning.id,
      ageMs,
    });
  }

  /**
   * Checks whether the most recent run is `paused_delta_guard`.
   * If it is and `force` is false, throws.
   * Returns true if this run bypasses the lock via force=true (for the
   * forcedOverride column), false otherwise.
   */
  private async checkDeltaGuardLock(
    storeId: number,
    force: boolean,
    actorIp?: string,
  ): Promise<boolean> {
    // F1 fix: exclude Running rows so a stale-but-allowed running row
    // does not shadow a paused_delta_guard row beneath it.
    const mostRecent = await this.runRepo.findOne({
      where: {
        storeId,
        status: Not(EStoreScrapeRunStatus.Running),
      },
      order: { startedAt: 'DESC' },
    });

    if (mostRecent?.status !== EStoreScrapeRunStatus.PausedDeltaGuard) {
      return false;
    }

    if (!force) {
      throw new ConflictException(
        `SCRAPE_PAUSED_OPERATOR_OVERRIDE_REQUIRED: storeId=${storeId} priorRunId=${mostRecent.id} deltaPercent=${mostRecent.deltaPercent}`,
      );
    }

    this.logger.warn('Delta-guard lock bypassed via force=true', {
      storeId,
      actorIp: actorIp ?? 'unknown',
      priorRunId: mostRecent.id,
      overriddenDeltaPercent: mostRecent.deltaPercent,
    });

    return true;
  }

  /**
   * Executes steps 5-9 of the pipeline. Separated from `runScrape` so the
   * error handler in `runScrape` can catch any error from this block cleanly.
   */
  private async executePipeline(
    store: StoreEntity,
    run: StoreScrapeRunEntity,
    forcedOverride: boolean,
    startedAt: Date,
    dryRun: boolean,
  ): Promise<IScrapeRunSummary> {
    // Step 5: scrape into staging map
    const { staging, productsFetched, productsMatched, productsUnmatched } =
      await this.scrapeIntoStaging(store);

    // Step 6: load existing store_stock rows for delta computation
    const existingRows = await this.stockRepo.find({ where: { storeId: store.id } });
    const existingMap = new Map(existingRows.map((r) => [r.cardIdentifier, r]));

    // Classify rows
    const toUpsert: Array<{ cardIdentifier: string; staged: IStagedProduct }> = [];
    const toZeroOut: string[] = [];

    for (const [cardIdentifier, staged] of staging.entries()) {
      const existing = existingMap.get(cardIdentifier);
      if (!existing) {
        // New row
        toUpsert.push({ cardIdentifier, staged });
      } else if (
        existing.priceCents !== staged.priceCents ||
        existing.quantity !== staged.quantity ||
        existing.productUrl !== staged.productUrl
      ) {
        // Changed row
        toUpsert.push({ cardIdentifier, staged });
      }
      // else: no-op (same data)
    }

    for (const [cardIdentifier] of existingMap.entries()) {
      if (!staging.has(cardIdentifier)) {
        toZeroOut.push(cardIdentifier);
      }
    }

    const rowsUpserted = toUpsert.length;
    const rowsZeroed = toZeroOut.length;
    const existingCount = existingRows.length;
    const deltaPercent =
      existingCount > 0
        ? ((rowsUpserted + rowsZeroed) / existingCount) * 100
        : null;

    // Step 7: delta-guard check
    if (deltaPercent !== null && deltaPercent > DELTA_GUARD_THRESHOLD_PCT) {
      // Check first-run exemption: keyed on completed-run history (NOT table state)
      const completedRunCount = await this.runRepo.count({
        where: { storeId: store.id, status: EStoreScrapeRunStatus.Completed },
      });

      if (completedRunCount > 0) {
        this.logger.error('Delta guard triggered — run aborted', {
          storeSlug: store.slug,
          deltaPercent,
          productsFetched,
          existingCount,
        });

        await this.runRepo.update(
          { id: run.id },
          {
            status: EStoreScrapeRunStatus.PausedDeltaGuard,
            finishedAt: new Date(),
            productsFetched,
            productsMatched,
            productsUnmatched,
            rowsUpserted: 0,
            rowsZeroed: 0,
            deltaPercent: Math.round(deltaPercent * 100) / 100,
          },
        );

        return {
          runId: run.id,
          productsFetched,
          productsMatched,
          productsUnmatched,
          rowsUpserted: 0,
          rowsZeroed: 0,
          deltaPercent: Math.round(deltaPercent * 100) / 100,
          durationMs: Date.now() - startedAt.getTime(),
          forcedOverride,
        };
      }

      this.logger.log('Delta guard: first-run exemption applied (no completed runs in history)', {
        storeSlug: store.slug,
        deltaPercent,
      });
    }

    // Step 8: persist changes in a single transaction (skip in dry-run mode)
    const now = new Date();

    if (dryRun) {
      this.logger.log('Dry-run mode: skipping DB writes (steps 8-9)', {
        storeSlug: store.slug,
        productsFetched,
        productsMatched,
        productsUnmatched,
        rowsUpserted,
        rowsZeroed,
        deltaPercent: deltaPercent !== null ? Math.round(deltaPercent * 100) / 100 : null,
      });

      // Mark the run row as completed with a dry-run note
      await this.runRepo.update(
        { id: run.id },
        {
          status: EStoreScrapeRunStatus.Completed,
          finishedAt: new Date(),
          productsFetched,
          productsMatched,
          productsUnmatched,
          rowsUpserted: 0,
          rowsZeroed: 0,
          deltaPercent: deltaPercent !== null ? Math.round(deltaPercent * 100) / 100 : null,
          errorMessage: 'DRY_RUN: scrape + match completed, no store_stock writes',
        },
      );

      return {
        runId: run.id,
        productsFetched,
        productsMatched,
        productsUnmatched,
        rowsUpserted: 0,
        rowsZeroed: 0,
        deltaPercent: deltaPercent !== null ? Math.round(deltaPercent * 100) / 100 : null,
        durationMs: Date.now() - startedAt.getTime(),
        forcedOverride,
      };
    }

    await this.dataSource.transaction(async (em) => {
      // Upsert new / changed rows
      for (const { cardIdentifier, staged } of toUpsert) {
        await em
          .createQueryBuilder()
          .insert()
          .into(StoreStockEntity)
          .values({
            storeId: store.id,
            cardIdentifier,
            priceCents: staged.priceCents,
            quantity: staged.quantity,
            productUrl: staged.productUrl,
            productNameRaw: staged.productNameRaw,
            lastFetchedAt: now,
          })
          .orUpdate(
            ['priceCents', 'quantity', 'productUrl', 'productNameRaw', 'lastFetchedAt'],
            ['storeId', 'cardIdentifier'],
          )
          .execute();
      }

      // Zero-out absent rows
      if (toZeroOut.length > 0) {
        await em
          .createQueryBuilder()
          .update(StoreStockEntity)
          .set({ quantity: 0, lastFetchedAt: now })
          .where('storeId = :storeId AND cardIdentifier IN (:...cardIdentifiers)', {
            storeId: store.id,
            cardIdentifiers: toZeroOut,
          })
          .execute();
      }
    });

    // Step 9: finalize
    const finishedAt = new Date();
    const roundedDelta =
      deltaPercent !== null ? Math.round(deltaPercent * 100) / 100 : null;

    await this.runRepo.update(
      { id: run.id },
      {
        status: EStoreScrapeRunStatus.Completed,
        finishedAt,
        productsFetched,
        productsMatched,
        productsUnmatched,
        rowsUpserted,
        rowsZeroed,
        deltaPercent: roundedDelta,
      },
    );

    await this.storeRepo.update({ id: store.id }, { lastScrapedAt: finishedAt });

    const durationMs = finishedAt.getTime() - startedAt.getTime();

    this.logger.log('Scrape run completed', {
      storeSlug: store.slug,
      runId: run.id,
      productsFetched,
      productsMatched,
      productsUnmatched,
      rowsUpserted,
      rowsZeroed,
      deltaPercent: roundedDelta,
      durationMs,
    });

    return {
      runId: run.id,
      productsFetched,
      productsMatched,
      productsUnmatched,
      rowsUpserted,
      rowsZeroed,
      deltaPercent: roundedDelta,
      durationMs,
      forcedOverride,
    };
  }

  /**
   * Iterates the scraper async generator and builds the in-memory staging map.
   *
   * Duplicate cardIdentifier strategy: prefer higher quantity, break ties by
   * lower price (null price ranks below any integer price).
   */
  private async scrapeIntoStaging(store: StoreEntity): Promise<{
    staging: Map<string, IStagedProduct>;
    productsFetched: number;
    productsMatched: number;
    productsUnmatched: number;
  }> {
    const staging = new Map<string, IStagedProduct>();
    let productsFetched = 0;
    let productsMatched = 0;
    let productsUnmatched = 0;

    for await (const product of this.scraper.scrapeStore(store)) {
      productsFetched++;

      const matchResults = await this.matcher.match(store.slug, product.rawName);

      if (matchResults.length === 0) {
        productsUnmatched++;
        continue;
      }

      productsMatched++;

      for (const matchResult of matchResults) {
        const { cardIdentifier } = matchResult;

        const existing = staging.get(cardIdentifier);
        if (existing) {
          // Duplicate: keep higher quantity; break ties by lower price
          const keepNew = shouldPreferNew(existing, product);
          if (keepNew) {
            staging.set(cardIdentifier, {
              priceCents: product.priceCents,
              quantity: product.quantity,
              productUrl: product.productUrl,
              productNameRaw: product.rawName,
            });
          }
          this.logger.debug('Duplicate cardIdentifier in stream — resolved via merge strategy', {
            storeSlug: store.slug,
            cardIdentifier,
            keptHigherQty: keepNew ? product.quantity : existing.quantity,
          });
        } else {
          staging.set(cardIdentifier, {
            priceCents: product.priceCents,
            quantity: product.quantity,
            productUrl: product.productUrl,
            productNameRaw: product.rawName,
          });
        }
      }
    }

    return { staging, productsFetched, productsMatched, productsUnmatched };
  }
}

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the incoming `product` should replace `existing` in the
 * staging map when both resolve to the same `cardIdentifier`.
 *
 * Strategy:
 * - Prefer higher quantity.
 * - On tie: prefer lower priceCents (null price ranks worst).
 */
function shouldPreferNew(
  existing: IStagedProduct,
  incoming: { priceCents: number | null; quantity: number },
): boolean {
  if (incoming.quantity > existing.quantity) return true;
  if (incoming.quantity < existing.quantity) return false;

  // Tie on quantity — prefer lower price
  if (existing.priceCents === null && incoming.priceCents !== null) return true;
  if (incoming.priceCents === null) return false;
  // Both are non-null at this point (narrowed above).
  return (incoming.priceCents as number) < (existing.priceCents as number);
}

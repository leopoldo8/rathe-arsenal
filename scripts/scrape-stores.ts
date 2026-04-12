import { config } from 'dotenv';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';

/**
 * Phase 1b Unit 4 — Store scrape worker.
 *
 * Bootstraps a NestJS standalone application context (no HTTP listener)
 * to access the full DI graph: FetchGuardService, CatalogService, TypeORM
 * repositories, CardNameMatcherService, SbraubleScraperService.
 *
 * Scheduled via Railway cron: `0 3 * * *` (daily 03:00 UTC).
 * Intended as a **separate Railway service** (same second-service pattern as
 * `scripts/purge-deleted-users.ts`) — the API pod is always-on and must not
 * carry a 10-15 minute I/O burst on its event loop.
 *
 * Flags:
 *   --store=<slug>   Run only the named store (e.g. `--store=cupula-dt`).
 *                    When omitted, all `active=true` stores are iterated.
 *   --dry-run        Scrape + match but do NOT write to store_stock.
 *                    Useful for verifying parser accuracy against production
 *                    before enabling writes (Gate 2 accuracy check).
 *
 * Environment:
 *   STORE_SCRAPER_ENABLED  Must be `true` — script exits cleanly otherwise.
 *   DATABASE_URL           Postgres connection string.
 *   ADMIN_API_KEY          Not used at runtime by this script; required
 *                          at API boot when STORE_SCRAPER_ENABLED=true.
 *
 * The script calls `app.close()` after all stores complete and exits with
 * code 0 on success or code 1 on any unhandled error, so Railway cron
 * treats non-zero exits as failed runs.
 */

interface IParsedFlags {
  readonly storeSlug: string | null;
  readonly dryRun: boolean;
}

function parseFlags(argv: readonly string[]): IParsedFlags {
  let storeSlug: string | null = null;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--store=')) {
      storeSlug = arg.slice('--store='.length);
    }
  }

  return { storeSlug, dryRun };
}

async function main(): Promise<void> {
  // Load env from the repo root .env — same pattern as purge-deleted-users.ts.
  config({ path: resolve(__dirname, '..', '.env') });

  const flags = parseFlags(process.argv.slice(2));

  // Gate: scraper must be explicitly enabled.
  const scraperEnabled =
    process.env.STORE_SCRAPER_ENABLED === 'true' ||
    process.env.STORE_SCRAPER_ENABLED === '1';

  if (!scraperEnabled) {
    console.log(
      JSON.stringify({
        event: 'scrape-worker.disabled',
        msg: 'STORE_SCRAPER_ENABLED is false — exiting without scraping',
        at: new Date().toISOString(),
      }),
    );
    process.exit(0);
  }

  if (flags.dryRun) {
    console.log(
      JSON.stringify({
        event: 'scrape-worker.dry-run',
        msg: '--dry-run flag detected. Scrape + match will run but no DB writes will occur.',
        at: new Date().toISOString(),
      }),
    );
  }

  // Lazy require to avoid loading AppModule before dotenv is configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../apps/api/src/app.module') as { AppModule: new () => object };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StoreIngestionService } = require('../apps/api/src/stores/store-ingestion.service') as {
    StoreIngestionService: new (...args: unknown[]) => { runScrape: (...a: unknown[]) => Promise<unknown> };
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DataSource } = require('typeorm') as typeof import('typeorm');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const ingestionService = app.get(StoreIngestionService);

  // Resolve store slugs to process.
  let slugs: string[];
  if (flags.storeSlug !== null) {
    slugs = [flags.storeSlug];
  } else {
    // Query active stores via the DataSource to avoid a circular service dependency.
    const dataSource = app.get(DataSource);
    const rows = await dataSource.query<Array<{ slug: string }>>(
      'SELECT slug FROM store WHERE active = true ORDER BY id ASC',
    );
    slugs = rows.map((r) => r.slug);
  }

  if (slugs.length === 0) {
    console.log(
      JSON.stringify({
        event: 'scrape-worker.no-stores',
        msg: 'No active stores found — nothing to scrape',
        at: new Date().toISOString(),
      }),
    );
    await app.close();
    process.exit(0);
  }

  let hasError = false;

  for (const slug of slugs) {
    try {
      const summary = await (ingestionService as unknown as {
        runScrape(slug: string, opts: { force?: boolean; dryRun?: boolean }): Promise<{
          runId: number;
          productsFetched: number;
          productsMatched: number;
          productsUnmatched: number;
          rowsUpserted: number;
          rowsZeroed: number;
          deltaPercent: number | null;
          durationMs: number;
          forcedOverride: boolean;
        }>;
      }).runScrape(slug, { dryRun: flags.dryRun });

      console.log(
        JSON.stringify({
          event: 'scrape-worker.store.completed',
          storeSlug: slug,
          ...summary,
          at: new Date().toISOString(),
        }),
      );
    } catch (err) {
      hasError = true;
      console.error(
        JSON.stringify({
          event: 'scrape-worker.store.failed',
          storeSlug: slug,
          error: err instanceof Error ? err.message : String(err),
          at: new Date().toISOString(),
        }),
      );
      // Per-store errors do not abort other stores.
    }
  }

  await app.close();
  process.exit(hasError ? 1 : 0);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      event: 'scrape-worker.fatal',
      error: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    }),
  );
  process.exit(1);
});

/**
 * Phase 1b Unit 4 — Store scrape worker (compiled entry point).
 *
 * Runs with `node scripts/scrape-stores.js` — no tsx needed.
 * Imports from the compiled API dist/ so NestJS decorators work correctly.
 *
 * Flags:
 *   --store=<slug>   Run only the named store.
 *   --dry-run        Scrape + match but skip DB writes.
 */

const { resolve } = require('path');

// Railway injects env vars; dotenv is only needed for local dev.
try {
  require('dotenv').config({ path: resolve(__dirname, '..', '.env') });
} catch {
  // dotenv not available in production — that's fine.
}

function parseFlags(argv) {
  let storeSlug = null;
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

async function main() {
  const flags = parseFlags(process.argv.slice(2));

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

  // Import from compiled dist/ — NestJS decorators require tsc output.
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../apps/api/dist/app.module');
  const { StoreIngestionService } = require('../apps/api/dist/stores/store-ingestion.service');
  const { DataSource } = require('typeorm');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const ingestionService = app.get(StoreIngestionService);

  let slugs;
  if (flags.storeSlug !== null) {
    slugs = [flags.storeSlug];
  } else {
    const dataSource = app.get(DataSource);
    const rows = await dataSource.query(
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
      const summary = await ingestionService.runScrape(slug, {
        dryRun: flags.dryRun,
      });

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

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { VariantFetchQueueService } from './variant-fetch-queue.service';
import { VariantJobProcessorService } from './variant-job-processor.service';
import { ResolveJobCardsService } from './resolve-job-cards.service';
import { StoreIngestionService } from './store-ingestion.service';
import { VariantFetchJobEntity } from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './types/fetch-card';

const POLL_MS = 3000;

/**
 * Minimum elapsed time between URL/name sync runs.
 * On startup the sync is triggered immediately (lastSyncAt = 0).
 */
const URL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_STORE_SLUG = 'cupula-dt';

export interface IDrainDeps {
  readonly queue: Pick<VariantFetchQueueService, 'reclaimOrphans' | 'claimNext'>;
  readonly processor: Pick<VariantJobProcessorService, 'process'>;
  readonly resolveCards: (job: VariantFetchJobEntity) => Promise<IFetchCard[]>;
  readonly workerId: string;
}

export async function drainOnce(deps: IDrainDeps): Promise<void> {
  await deps.queue.reclaimOrphans();
  const job = await deps.queue.claimNext(deps.workerId);
  if (!job) return;
  const cards = await deps.resolveCards(job);
  await deps.processor.process(job, cards);
}

/**
 * Returns true when enough time has elapsed since the last URL sync to
 * justify running another one. Keeps all cadence logic testable without I/O.
 */
export function shouldRunSync(lastSyncAt: number, nowMs: number): boolean {
  return nowMs - lastSyncAt >= URL_SYNC_INTERVAL_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const logger = new Logger('VariantQueueWorker');
  // Imported dynamically so loading this module for unit tests does not pull in
  // AppModule's eager environment validation (which has no env in CI/test).
  const { AppModule } = await import('../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const queue = app.get(VariantFetchQueueService);
  const processor = app.get(VariantJobProcessorService);
  const resolver = app.get(ResolveJobCardsService);
  const ingestion = app.get(StoreIngestionService);
  const workerId = `worker-${randomUUID()}`;
  const resolveCards = (job: VariantFetchJobEntity): Promise<IFetchCard[]> =>
    resolver.resolve(job.storeId, job.cards.map((c) => c.cardIdentifier));

  // Initialize to 0 so the sync runs immediately on startup.
  let lastSyncAt = 0;

  while (true) {
    // URL/name sync cadence: run once on startup and then every ~24h.
    if (shouldRunSync(lastSyncAt, Date.now())) {
      lastSyncAt = Date.now();
      try {
        const summary = await ingestion.runUrlSync(DEFAULT_STORE_SLUG);
        logger.log({
          event: 'url-sync.completed',
          storeSlug: DEFAULT_STORE_SLUG,
          ...summary,
        });
      } catch (err) {
        logger.error({
          event: 'url-sync.error',
          storeSlug: DEFAULT_STORE_SLUG,
          error: (err as Error).message,
        });
      }
    }

    try {
      await drainOnce({ queue, processor, resolveCards, workerId });
    } catch (err) {
      logger.error({
        event: 'variant-worker.error',
        error: (err as Error).message,
        at: new Date().toISOString(),
      });
    }
    await sleep(POLL_MS);
  }
}

if (require.main === module) {
  void main();
}

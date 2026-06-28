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

export interface IUrlSyncDeps {
  readonly ingestion: Pick<
    StoreIngestionService,
    'claimPendingUrlSync' | 'runUrlSync' | 'markUrlSyncIdle'
  >;
  readonly logger: Pick<Logger, 'log' | 'error'>;
}

/**
 * Runs one queued URL sync if the owner has requested one. URL sync is no
 * longer on an automatic cadence — it is owner-triggered only (see
 * docs/research/scraper-cost-scaling.md) to keep Firecrawl credit spend
 * controlled. The claim is atomic + lock-guarded so the fast worker loop never
 * starts the long sync twice.
 */
export async function runPendingUrlSync(deps: IUrlSyncDeps): Promise<void> {
  const slug = await deps.ingestion.claimPendingUrlSync();
  if (!slug) return;
  deps.logger.log({ event: 'url-sync.claimed', storeSlug: slug });
  try {
    const summary = await deps.ingestion.runUrlSync(slug);
    deps.logger.log({ event: 'url-sync.completed', storeSlug: slug, ...summary });
  } catch (err) {
    deps.logger.error({ event: 'url-sync.error', storeSlug: slug, error: (err as Error).message });
  } finally {
    await deps.ingestion.markUrlSyncIdle(slug);
  }
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

  logger.log({ event: 'variant-worker.started' });

  while (true) {
    // Owner-triggered URL sync (no automatic cadence).
    try {
      await runPendingUrlSync({ ingestion, logger });
    } catch (err) {
      logger.error({ event: 'url-sync.claim_error', error: (err as Error).message });
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

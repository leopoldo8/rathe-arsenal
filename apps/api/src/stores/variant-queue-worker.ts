import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { AppModule } from '../app.module';
import { VariantFetchQueueService } from './variant-fetch-queue.service';
import { VariantJobProcessorService } from './variant-job-processor.service';
import { ResolveJobCardsService } from './resolve-job-cards.service';
import { VariantFetchJobEntity } from '../database/entities/variant-fetch-job.entity';
import { IFetchCard } from './variant-fetch.service';

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const queue = app.get(VariantFetchQueueService);
  const processor = app.get(VariantJobProcessorService);
  const resolver = app.get(ResolveJobCardsService);
  const workerId = `worker-${randomUUID()}`;
  const resolveCards = (job: VariantFetchJobEntity): Promise<IFetchCard[]> =>
    resolver.resolve(job.storeId, job.cards.map((c) => c.cardIdentifier));
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await drainOnce({ queue, processor, resolveCards, workerId });
    } catch (err) {
      console.error(JSON.stringify({ event: 'variant-worker.error', error: (err as Error).message, at: new Date().toISOString() }));
    }
    await sleep(POLL_MS);
  }
}

if (require.main === module) {
  void main();
}

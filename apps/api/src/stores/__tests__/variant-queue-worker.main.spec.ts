import { NestFactory } from '@nestjs/core';
import { RecommendationQueueService } from '../../recommendations/recommendation-queue.service';
import { RecommendationRunnerService } from '../../recommendations/recommendation-runner.service';
import { ResolveJobCardsService } from '../resolve-job-cards.service';
import { StoreIngestionService } from '../store-ingestion.service';
import { VariantFetchQueueService } from '../variant-fetch-queue.service';
import { VariantJobProcessorService } from '../variant-job-processor.service';
import { main, POLL_MS } from '../variant-queue-worker';

jest.mock('@nestjs/core', () => ({ NestFactory: { createApplicationContext: jest.fn() } }));
jest.mock('../../app.module', () => ({ AppModule: class AppModule {} }));

describe('variant-queue-worker main', () => {
  const savedKey = process.env['GEMINI_API_KEY'];

  afterEach(() => {
    jest.useRealTimers();
    if (savedKey === undefined) delete process.env['GEMINI_API_KEY'];
    else process.env['GEMINI_API_KEY'] = savedKey;
  });

  it('boots the application context and runs both drains with the process key', async () => {
    jest.useFakeTimers();
    process.env['GEMINI_API_KEY'] = 'AIza-main';
    const variantQueue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(null) };
    const recommendationRunner = { process: jest.fn() };
    const services = new Map<unknown, unknown>([
      [VariantFetchQueueService, variantQueue],
      [VariantJobProcessorService, { process: jest.fn() }],
      [ResolveJobCardsService, { resolve: jest.fn() }],
      [StoreIngestionService, { claimPendingUrlSync: jest.fn().mockResolvedValue(null) }],
      [RecommendationQueueService, { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue({ id: 'run-1' }) }],
      [RecommendationRunnerService, recommendationRunner],
    ]);
    (NestFactory.createApplicationContext as jest.Mock).mockResolvedValue({ get: (token: unknown) => services.get(token) });

    void main();
    await jest.advanceTimersByTimeAsync(2 * POLL_MS);

    expect(NestFactory.createApplicationContext).toHaveBeenCalledTimes(1);
    expect(variantQueue.claimNext.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(recommendationRunner.process.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(recommendationRunner.process).toHaveBeenCalledWith({ id: 'run-1' }, { apiKey: 'AIza-main', fetch });
  });
});

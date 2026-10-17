import {
  createChatStep,
  createRecommendationStep,
  defaultWorkerDeps,
  drainOnce,
  loopForever,
  POLL_MS,
  runPendingUrlSync,
  runWorker,
  runWorkerLoops,
} from '../variant-queue-worker';
import { VariantFetchQueueService } from '../variant-fetch-queue.service';
import { VariantJobProcessorService } from '../variant-job-processor.service';
import { ResolveJobCardsService } from '../resolve-job-cards.service';
import { StoreIngestionService } from '../store-ingestion.service';
import { RecommendationQueueService } from '../../recommendations/recommendation-queue.service';
import { RecommendationRunnerService } from '../../recommendations/recommendation-runner.service';
import { ChatTurnQueueService } from '../../chat/chat-turn-queue.service';
import { ChatRunnerService } from '../../chat/chat-runner.service';
import { TournamentSyncService } from '../../reference/tournament-sync.service';
import { RulesImportService } from '../../reference/rules-import.service';

describe('drainOnce', () => {
  it('reclaims orphans, claims a job, resolves its cards, and processes it', async () => {
    const claimed = { id: 'job-1', deckId: 42, storeId: 1, cards: [{ cardIdentifier: 'a-red', status: 'pending' }] };
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(claimed) };
    const processor = { process: jest.fn() };
    const resolveCards = jest.fn().mockResolvedValue([{ cardIdentifier: 'a-red', productUrl: 'u', listingPriceCents: null, listingQuantity: 0 }]);
    await drainOnce({ queue, processor, resolveCards, workerId: 'w1' } as never);
    expect(queue.reclaimOrphans).toHaveBeenCalled();
    expect(queue.claimNext).toHaveBeenCalledWith('w1');
    expect(processor.process).toHaveBeenCalledWith(claimed, expect.arrayContaining([expect.objectContaining({ cardIdentifier: 'a-red' })]));
  });

  it('does nothing further when the queue is empty', async () => {
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(null) };
    const processor = { process: jest.fn() };
    await drainOnce({ queue, processor, resolveCards: jest.fn(), workerId: 'w1' } as never);
    expect(processor.process).not.toHaveBeenCalled();
  });
});

describe('runPendingUrlSync', () => {
  const logger = { log: jest.fn(), error: jest.fn() };

  it('does nothing when no sync is queued', async () => {
    const ingestion = {
      claimPendingUrlSync: jest.fn().mockResolvedValue(null),
      runUrlSync: jest.fn(),
      markUrlSyncIdle: jest.fn(),
    };
    await runPendingUrlSync({ ingestion, logger } as never);
    expect(ingestion.runUrlSync).not.toHaveBeenCalled();
    expect(ingestion.markUrlSyncIdle).not.toHaveBeenCalled();
  });

  it('runs the claimed slug and always clears the running lock', async () => {
    const ingestion = {
      claimPendingUrlSync: jest.fn().mockResolvedValue('cupula-dt'),
      runUrlSync: jest.fn().mockResolvedValue({ productsFetched: 5, productsMatched: 4, rowsUpserted: 4 }),
      markUrlSyncIdle: jest.fn(),
      markUrlSyncFailed: jest.fn(),
    };
    await runPendingUrlSync({ ingestion, logger } as never);
    expect(ingestion.runUrlSync).toHaveBeenCalledWith('cupula-dt');
    expect(ingestion.markUrlSyncIdle).toHaveBeenCalledWith('cupula-dt');
    expect(ingestion.markUrlSyncFailed).not.toHaveBeenCalled();
  });

  it('records the failure and clears the running lock when the sync throws', async () => {
    const ingestion = {
      claimPendingUrlSync: jest.fn().mockResolvedValue('cupula-dt'),
      runUrlSync: jest.fn().mockRejectedValue(new Error('blocked')),
      markUrlSyncIdle: jest.fn(),
      markUrlSyncFailed: jest.fn(),
    };
    await runPendingUrlSync({ ingestion, logger } as never);
    expect(ingestion.markUrlSyncFailed).toHaveBeenCalledWith('cupula-dt', 'blocked');
    expect(ingestion.markUrlSyncIdle).toHaveBeenCalledWith('cupula-dt');
  });

  it('still clears the running lock when recording the failure also throws', async () => {
    const ingestion = {
      claimPendingUrlSync: jest.fn().mockResolvedValue('cupula-dt'),
      runUrlSync: jest.fn().mockRejectedValue(new Error('blocked')),
      markUrlSyncIdle: jest.fn(),
      markUrlSyncFailed: jest.fn().mockRejectedValue(new Error('db down')),
    };
    await expect(runPendingUrlSync({ ingestion, logger } as never)).rejects.toThrow('db down');
    expect(ingestion.markUrlSyncIdle).toHaveBeenCalledWith('cupula-dt');
  });
});

describe('loopForever', () => {
  it('a stuck recommendation drain does not block the variant drain', async () => {
    jest.useFakeTimers();
    try {
      let running = true;
      const variantStep = jest.fn(async () => undefined);
      const stuckRecommendationStep = jest.fn(() => new Promise<void>(() => undefined));

      void loopForever(variantStep, POLL_MS, () => running);
      void loopForever(stuckRecommendationStep, POLL_MS, () => running);
      await jest.advanceTimersByTimeAsync(3 * POLL_MS);
      running = false;

      expect(stuckRecommendationStep).toHaveBeenCalledTimes(1);
      expect(variantStep.mock.calls.length).toBeGreaterThanOrEqual(3);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('worker assembly', () => {
  it('the worker reads GEMINI_API_KEY per run and runs both loops', async () => {
    const env: NodeJS.ProcessEnv = {};
    const run = { id: 'run-1' };
    const queue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(run) };
    const runner = { process: jest.fn() };
    const logger = { error: jest.fn() };
    const fetch = jest.fn();
    const step = createRecommendationStep({ queue, runner, env, fetch, logger } as never);

    await step();
    env['GEMINI_API_KEY'] = 'AIza-later';
    await step();
    runner.process.mockRejectedValueOnce(new Error('db down'));
    await step();

    expect(runner.process.mock.calls.map(([, deps]) => deps.apiKey)).toEqual([undefined, 'AIza-later', 'AIza-later']);
    expect(runner.process.mock.calls.map(([, deps]) => deps.thinkingLevel)).toEqual([undefined, undefined, undefined]);
    env['GEMINI_THINKING_LEVEL'] = 'low';
    await step();
    expect(runner.process.mock.calls[3][1].thinkingLevel).toBe('low');
    expect(runner.process.mock.calls[0][1].fetch).toBe(fetch);
    expect(logger.error).toHaveBeenCalledWith({ event: 'recommendations.worker.error', error: 'db down' });

    jest.useFakeTimers();
    try {
      let running = true;
      const first = jest.fn(async () => undefined);
      const second = jest.fn(async () => undefined);
      void runWorkerLoops([first, second], POLL_MS, () => running);
      await jest.advanceTimersByTimeAsync(2 * POLL_MS);
      running = false;
      expect(first.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(second.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('model choice', () => {
  it('each feature goes to OpenRouter with its key only when its own model variable is set', async () => {
    const env: NodeJS.ProcessEnv = { GEMINI_API_KEY: 'gemini-key', OPENROUTER_API_KEY: 'openrouter-key', CHAT_OPENROUTER_MODEL: 'openai/gpt-6-luna' };
    const deps = () => ({
      queue: { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue({ id: 'run-1' }) },
      runner: { process: jest.fn() },
      env,
      fetch: jest.fn(),
      logger: { error: jest.fn() },
    });
    const recommendation = deps();
    const chat = deps();

    await createRecommendationStep(recommendation as never)();
    await createChatStep(chat as never)();
    env['RECOMMENDATION_OPENROUTER_MODEL'] = ' openai/gpt-6-luna ';
    await createRecommendationStep(recommendation as never)();

    const seen = (step: ReturnType<typeof deps>) => step.runner.process.mock.calls.map(([, used]) => [used.apiKey, used.openRouterModel]);
    expect(seen(recommendation)).toEqual([
      ['gemini-key', undefined],
      ['openrouter-key', 'openai/gpt-6-luna'],
    ]);
    expect(seen(chat)).toEqual([['openrouter-key', 'openai/gpt-6-luna']]);
  });
});

describe('runWorker', () => {
  it('wires both drains from the application context and reads the key from the environment it is given', async () => {
    jest.useFakeTimers();
    try {
      const variantQueue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(null) };
      const ingestion = { claimPendingUrlSync: jest.fn().mockResolvedValue(null) };
      const recommendationQueue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue({ id: 'run-1' }) };
      const recommendationRunner = { process: jest.fn() };
      const services = new Map<unknown, unknown>([
        [VariantFetchQueueService, variantQueue],
        [VariantJobProcessorService, { process: jest.fn() }],
        [ResolveJobCardsService, { resolve: jest.fn() }],
        [StoreIngestionService, ingestion],
        [RecommendationQueueService, recommendationQueue],
        [RecommendationRunnerService, recommendationRunner],
      ]);
      const app = { get: (token: unknown) => services.get(token) };
      const fetch = jest.fn();
      let running = true;

      void runWorker(app as never, { env: { GEMINI_API_KEY: 'AIza-env' }, fetch, shouldContinue: () => running }, { log: jest.fn(), error: jest.fn() });
      await jest.advanceTimersByTimeAsync(2 * POLL_MS);
      running = false;

      expect(variantQueue.claimNext.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(ingestion.claimPendingUrlSync).toHaveBeenCalled();
      expect(recommendationRunner.process.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(recommendationRunner.process).toHaveBeenCalledWith({ id: 'run-1' }, { apiKey: 'AIza-env', fetch });
    } finally {
      jest.useRealTimers();
    }
  });

  it('defaults to the process environment and the global fetch', () => {
    const deps = defaultWorkerDeps();

    expect(deps.env).toBe(process.env);
    expect(deps.fetch).toBe(fetch);
    expect(deps.pollMs).toBeUndefined();
    expect(deps.shouldContinue).toBeUndefined();
  });
});

describe('worker loops', () => {
  it('chat and reference loops run beside a stuck recommendation drain', async () => {
    jest.useFakeTimers();
    try {
      const chatQueue = { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue({ id: 'turn-1' }) };
      const chatRunner = { process: jest.fn() };
      const tournaments = { isDue: jest.fn().mockResolvedValue(false), sync: jest.fn() };
      const rules = { isDue: jest.fn().mockResolvedValue(false), importIndex: jest.fn() };
      const services = new Map<unknown, unknown>([
        [VariantFetchQueueService, { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue(null) }],
        [VariantJobProcessorService, { process: jest.fn() }],
        [ResolveJobCardsService, { resolve: jest.fn() }],
        [StoreIngestionService, { claimPendingUrlSync: jest.fn().mockResolvedValue(null) }],
        [RecommendationQueueService, { reclaimOrphans: jest.fn(), claimNext: jest.fn().mockResolvedValue({ id: 'run-1' }) }],
        [RecommendationRunnerService, { process: jest.fn(() => new Promise<void>(() => undefined)) }],
        [ChatTurnQueueService, chatQueue],
        [ChatRunnerService, chatRunner],
        [TournamentSyncService, tournaments],
        [RulesImportService, rules],
      ]);
      const fetch = jest.fn();
      let running = true;

      void runWorker(
        { get: (token: unknown) => services.get(token) } as never,
        { env: { GEMINI_API_KEY: 'AIza-env', GEMINI_CHAT_THINKING_LEVEL: 'low' }, fetch, shouldContinue: () => running },
        { log: jest.fn(), error: jest.fn() },
      );
      await jest.advanceTimersByTimeAsync(3 * POLL_MS);
      running = false;

      expect(chatRunner.process.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(chatRunner.process).toHaveBeenCalledWith({ id: 'turn-1' }, { apiKey: 'AIza-env', fetch, thinkingLevel: 'low' });
      expect(tournaments.isDue.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(rules.isDue.mock.calls.length).toBeGreaterThanOrEqual(3);
    } finally {
      jest.useRealTimers();
    }
  });
});

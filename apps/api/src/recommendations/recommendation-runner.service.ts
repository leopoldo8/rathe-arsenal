import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { RecommendationRunEntity, TRecommendationFailureCode } from '../database/entities/recommendation-run.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { callGemini, GEMINI_MODEL, TGeminiFetch, TGeminiThinkingLevel } from './gemini-client';
import {
  buildRecommendationPool,
  buildRecommendationPrompt,
  computeDeckFingerprint,
  IDeckList,
} from './recommendation-prompt';
import { RecommendationQueueService } from './recommendation-queue.service';
import { RecommendationsQueryService } from './recommendations-query.service';
import { selectRecommendations } from './validate-answer';

export const MAX_RUN_ATTEMPTS = 3;
export const RETRY_BASE_MS = 60_000;

export interface IRunnerDeps {
  readonly apiKey: string | null | undefined;
  readonly fetch: TGeminiFetch;
  readonly thinkingLevel?: TGeminiThinkingLevel | undefined;
}

@Injectable()
export class RecommendationRunnerService {
  private readonly logger = new Logger(RecommendationRunnerService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly queue: RecommendationQueueService,
    private readonly query: RecommendationsQueryService,
  ) {}

  async process(run: RecommendationRunEntity, deps: IRunnerDeps): Promise<void> {
    const startedAt = Date.now();
    this.logger.log({ event: 'recommendations.run.claimed', trackedDeckId: run.trackedDeckId, runId: run.id, attempts: run.attempts });

    const deck = await this.dataSource.getRepository(TrackedDeckEntity).findOne({ where: { id: run.trackedDeckId } });
    if (!deck) return;
    if (run.trigger === 'auto' && deck.status === 'retired') return this.fail(run, 'DECK_RETIRED');
    const heroCard = this.findCard(deck.heroIdentifier);
    if (heroCard === null) return this.fail(run, 'DECK_INVALID');
    const apiKey = deps.apiKey?.trim();
    if (!apiKey) return this.fail(run, 'NO_API_KEY');

    const [deckCards, excluded] = await Promise.all([
      this.dataSource.getRepository(DeckCardEntity).find({ where: { trackedDeckId: deck.id } }),
      this.query.excludedCards([deck.id]),
    ]);
    const deckList: IDeckList = {
      heroIdentifier: deck.heroIdentifier,
      format: deck.format,
      cards: deckCards.map((row) => ({ cardIdentifier: row.cardIdentifier, slot: row.slot, quantity: row.quantity })),
    };
    const pool = buildRecommendationPool(deckList, heroCard, excluded.get(deck.id) ?? new Set(), catalog);
    const deckFingerprint = computeDeckFingerprint(deckList);
    const prompt = buildRecommendationPrompt(deckList, heroCard, pool, catalog);
    this.logger.log({
      event: 'recommendations.run.request',
      trackedDeckId: run.trackedDeckId,
      runId: run.id,
      poolSize: pool.length,
      promptChars: prompt.system.length + prompt.prompt.length,
      thinkingLevel: deps.thinkingLevel ?? 'default',
    });
    const outcome = await callGemini(apiKey, prompt, deps.fetch, { thinkingLevel: deps.thinkingLevel });

    if (outcome.kind === 'retry') {
      if (run.attempts >= MAX_RUN_ATTEMPTS) return this.fail(run, outcome.code);
      const { result, runAfter } = await this.queue.retryAfter(run, RETRY_BASE_MS * 2 ** (run.attempts - 1));
      this.logger.log({
        event: 'recommendations.run.retry',
        trackedDeckId: run.trackedDeckId,
        runId: run.id,
        status: outcome.status,
        runAfter: runAfter.toISOString(),
        result,
      });
      return;
    }
    if (outcome.kind === 'failed') return this.fail(run, outcome.code, outcome.detail, Date.now() - startedAt);

    const { kept, dropped } = selectRecommendations(
      outcome.entries,
      new Set(pool.map((card) => card.cardIdentifier)),
      deckList.cards,
      catalog,
    );
    await this.queue.finishDone(run, {
      deckFingerprint,
      model: GEMINI_MODEL,
      inputTokens: outcome.usage.inputTokens,
      outputTokens: outcome.usage.outputTokens,
      kept,
    });
    this.logger.log({
      event: 'recommendations.run.done',
      trackedDeckId: run.trackedDeckId,
      runId: run.id,
      kept: kept.length,
      dropped,
      clearUpgrades: kept.filter((entry) => entry.strength === 'clear_upgrade').length,
      inputTokens: outcome.usage.inputTokens,
      outputTokens: outcome.usage.outputTokens,
      durationMs: Date.now() - startedAt,
    });
  }

  private async fail(
    run: RecommendationRunEntity,
    code: TRecommendationFailureCode,
    detail?: string,
    elapsedMs?: number,
  ): Promise<void> {
    await this.queue.finishFailed(run.id, code);
    this.logger.warn({
      event: 'recommendations.run.failed',
      trackedDeckId: run.trackedDeckId,
      runId: run.id,
      code,
      attempts: run.attempts,
      ...(detail === undefined ? {} : { detail }),
      ...(elapsedMs === undefined ? {} : { elapsedMs }),
    });
  }

  private findCard(cardIdentifier: string | null): ICatalogCard | null {
    if (!cardIdentifier) return null;
    try {
      return catalog.getCard(cardIdentifier);
    } catch {
      return null;
    }
  }
}

export interface IRecommendationDrainDeps {
  readonly queue: Pick<RecommendationQueueService, 'reclaimOrphans' | 'claimNext'>;
  readonly runner: Pick<RecommendationRunnerService, 'process'>;
  readonly readApiKey: () => string | null | undefined;
  readonly readThinkingLevel?: () => TGeminiThinkingLevel | undefined;
  readonly fetch: TGeminiFetch;
}

export async function drainRecommendationsOnce(deps: IRecommendationDrainDeps): Promise<boolean> {
  await deps.queue.reclaimOrphans();
  const run = await deps.queue.claimNext();
  if (!run) return false;
  await deps.runner.process(run, {
    apiKey: deps.readApiKey(),
    fetch: deps.fetch,
    thinkingLevel: deps.readThinkingLevel?.(),
  });
  return true;
}

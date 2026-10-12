import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { resolveLocale } from '../common/i18n/resolve-locale';
import { TGeminiFetch, TGeminiThinkingLevel } from '../recommendations/gemini-client';
import { ChatBudgetService } from './chat-budget.service';
import { buildHistory, IHistoryMessage } from './chat-history';
import { priceCall } from './chat-pricing';
import { buildSystemInstruction, IBoundDeck, IDeckSummary } from './chat-prompt';
import { runChatTool } from './chat-tools';
import { ChatToolsService } from './chat-tools.service';
import { runTurn } from './chat-turn';
import { ChatTurnQueueService, IClaimedTurn } from './chat-turn-queue.service';
import { callGeminiChat, CHAT_MODEL, IGeminiContent, withProviderRetry } from './gemini-chat-client';

export interface IChatRunnerDeps {
  readonly apiKey: string | null | undefined;
  readonly fetch: TGeminiFetch;
  readonly thinkingLevel?: TGeminiThinkingLevel | undefined;
  readonly now?: () => Date;
  readonly sleep?: ((ms: number) => Promise<void>) | undefined;
}

@Injectable()
export class ChatRunnerService {
  private readonly logger = new Logger(ChatRunnerService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly queue: ChatTurnQueueService,
    private readonly budget: ChatBudgetService,
    private readonly tools: ChatToolsService,
  ) {}

  async process(turn: IClaimedTurn, deps: IChatRunnerDeps): Promise<void> {
    const now = deps.now ?? (() => new Date());
    const startedAt = now().getTime();
    const base = { messageId: turn.id, conversationId: turn.conversationId, userId: turn.userId };
    this.logger.log({ event: 'chat.turn.claimed', ...base, attempts: turn.attempts });

    if (await this.budget.isExhausted(turn.userId, now())) return this.fail(turn, 'BUDGET_EXHAUSTED');
    const apiKey = deps.apiKey?.trim();
    if (!apiKey) return this.fail(turn, 'NO_API_KEY');

    const locale = resolveLocale(turn.locale);
    const { toolbox, proposals } = this.tools.forTurn({ userId: turn.userId, locale });
    let costUsd = 0;
    const result = await runTurn({
      system: buildSystemInstruction({
        locale,
        decks: await this.deckSummaries(turn.userId),
        boundDeck: turn.trackedDeckId === null ? null : await this.boundDeck(turn.userId, turn.trackedDeckId),
        today: now(),
      }),
      history: buildHistory(await this.historyBefore(turn)),
      call: (request) =>
        withProviderRetry(() => callGeminiChat(apiKey, request, deps.fetch, { thinkingLevel: deps.thinkingLevel }), {
          sleep: deps.sleep,
          onRetry: async (retry) => {
            this.logger.log({ event: 'chat.turn.retry', ...base, ...retry });
            await this.queue.heartbeat(turn.id);
          },
        }),
      recordUsage: async (usage) => {
        const cost = priceCall(CHAT_MODEL, usage, now());
        costUsd += cost;
        await this.queue.recordUsage(turn, { model: CHAT_MODEL, ...usage, costUsd: cost });
        await this.queue.heartbeat(turn.id);
      },
      runTool: (name, args) => runChatTool(toolbox, name, args),
      now: () => now().getTime(),
      onTool: (tool, durationMs) => this.logger.log({ event: 'chat.turn.tool', ...base, tool, durationMs }),
    });
    const totals = { model: CHAT_MODEL, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd };

    if (result.kind === 'failed') return this.fail(turn, result.code, { ...totals, detail: result.detail });
    await this.queue.finishDone(turn, { text: result.text, contents: result.contents, proposals, ...totals });
    this.logger.log({
      event: 'chat.turn.done',
      ...base,
      rounds: result.calls,
      proposals: proposals.length,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      costUsd,
      durationMs: now().getTime() - startedAt,
    });
  }

  private async fail(
    turn: IClaimedTurn,
    code: Parameters<ChatTurnQueueService['finishFailed']>[1]['code'],
    totals?: { model: string; inputTokens: number; outputTokens: number; costUsd: number; detail: string },
  ): Promise<void> {
    await this.queue.finishFailed(turn, { code, ...(totals ?? {}) });
    this.logger.warn({
      event: 'chat.turn.failed',
      messageId: turn.id,
      conversationId: turn.conversationId,
      userId: turn.userId,
      code,
      attempts: turn.attempts,
      ...(totals ? { detail: totals.detail } : {}),
    });
  }

  private async historyBefore(turn: IClaimedTurn): Promise<IHistoryMessage[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, role, status, text, "modelContent" FROM chat_message WHERE "conversationId" = $1
        ORDER BY "createdAt", CASE role WHEN 'user' THEN 0 ELSE 1 END, id`,
      [turn.conversationId],
    )) as Array<{ id: string; role: 'user' | 'assistant'; status: string; text: string | null; modelContent: IGeminiContent[] | null }>;
    const end = rows.findIndex((row) => row.id === turn.id);
    return rows.slice(0, end < 0 ? rows.length : end);
  }

  private async deckSummaries(userId: string): Promise<IDeckSummary[]> {
    return (await this.dataSource.query(
      `SELECT d.id, d.name, d.hero, d."heroIdentifier", d.format, d.status, s."effectivePercent"::float8 AS "readinessPercent"
         FROM tracked_deck d
         LEFT JOIN LATERAL (
           SELECT "effectivePercent" FROM deck_readiness_snapshot WHERE "trackedDeckId" = d.id ORDER BY "computedAt" DESC, id DESC LIMIT 1
         ) s ON true
        WHERE d."userId" = $1 ORDER BY d.id`,
      [userId],
    )) as IDeckSummary[];
  }

  private async boundDeck(userId: string, trackedDeckId: number): Promise<IBoundDeck | null> {
    const [deck] = (await this.dataSource.query(`SELECT id, name, "heroIdentifier" FROM tracked_deck WHERE id = $1 AND "userId" = $2`, [
      trackedDeckId,
      userId,
    ])) as Array<{ id: number; name: string; heroIdentifier: string | null }>;
    if (!deck) return null;
    const cards = (await this.dataSource.query(
      `SELECT "cardIdentifier", quantity, slot FROM deck_card WHERE "trackedDeckId" = $1 ORDER BY slot, "cardIdentifier"`,
      [trackedDeckId],
    )) as IBoundDeck['cards'];
    const hero = deck.heroIdentifier ? [{ cardIdentifier: deck.heroIdentifier, quantity: 1, slot: 'hero' }] : [];
    return { id: deck.id, name: deck.name, cards: [...hero, ...cards.filter((card) => card.slot !== 'hero')] };
  }
}

export interface IChatDrainDeps {
  readonly queue: Pick<ChatTurnQueueService, 'reclaimOrphans' | 'claimNext'>;
  readonly runner: Pick<ChatRunnerService, 'process'>;
  readonly readApiKey: () => string | null | undefined;
  readonly readThinkingLevel?: () => TGeminiThinkingLevel | undefined;
  readonly fetch: TGeminiFetch;
  readonly sleep?: ((ms: number) => Promise<void>) | undefined;
}

export async function drainChatOnce(deps: IChatDrainDeps): Promise<boolean> {
  await deps.queue.reclaimOrphans();
  const turn = await deps.queue.claimNext();
  if (!turn) return false;
  await deps.runner.process(turn, { apiKey: deps.readApiKey(), fetch: deps.fetch, thinkingLevel: deps.readThinkingLevel?.(), sleep: deps.sleep });
  return true;
}

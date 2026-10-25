import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { DecksImportService } from '../../decks/import/decks-import.service';
import { parseThinkingLevel, TGeminiFetch } from '../../recommendations/gemini-client';
import { ChatRunnerService } from '../chat-runner.service';
import { ChatTurnQueueService } from '../chat-turn-queue.service';
import { ChatService } from '../chat.service';
import { EVAL_DECKS, EVAL_SCENARIOS, IEvalScenario, IEvalSwap, TEvalDeckKey } from './chat-eval-scenarios';

export const EVAL_USER_EMAIL = 'tutor-eval@rathe-arsenal.invalid';
const UNUSABLE_PASSWORD_HASH = '!'.repeat(60);
const TURN_WAIT_MS = 10 * 60 * 1000;
const WAIT_POLL_MS = 3_000;
const TOOL_ARGS_SHOWN = 120;

export interface IModelCallTrace {
  readonly ms: number;
  readonly status: number;
  readonly finishReason: string | null;
  readonly toolCalls: readonly string[];
  readonly error: string | null;
}

export interface IEvalRun {
  readonly scenario: string;
  readonly run: number;
  readonly question: string;
  readonly model: string | null;
  readonly status: string;
  readonly error: string | null;
  readonly turnMs: number;
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly calls: readonly IModelCallTrace[];
  readonly text: string | null;
  readonly swaps: readonly IEvalSwap[];
  readonly check: { readonly failure: string | null } | null;
}

interface IEvalOptions {
  readonly runs: number;
  readonly concurrency: number;
  readonly only: readonly string[];
  readonly drive: boolean;
  readonly out: string;
  readonly extra: readonly IEvalScenario[];
  readonly model: string | undefined;
  readonly maxUsd: number;
}

const DEFAULT_MAX_USD = 3;

function readOptions(argv: readonly string[]): IEvalOptions {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    runs: Number(value('--runs') ?? 2),
    concurrency: Number(value('--concurrency') ?? 3),
    only: (value('--only') ?? '').split(',').filter(Boolean),
    drive: !argv.includes('--observe'),
    out: value('--out') ?? 'chat-eval-report',
    extra: value('--scenarios') ? (JSON.parse(readFileSync(value('--scenarios')!, 'utf8')) as IEvalScenario[]) : [],
    model: value('--model'),
    maxUsd: Number(value('--max-usd') ?? DEFAULT_MAX_USD),
  };
}

async function ensureEvalUser(dataSource: DataSource): Promise<string> {
  const [row] = (await dataSource.query(
    `INSERT INTO "user" (email, "passwordHash", "emailVerifiedAt", "chatAccess") VALUES ($1, $2, now(), true)
     ON CONFLICT DO NOTHING RETURNING id`,
    [EVAL_USER_EMAIL, UNUSABLE_PASSWORD_HASH],
  )) as Array<{ id: string }>;
  if (row) return row.id;
  const [existing] = (await dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [EVAL_USER_EMAIL])) as Array<{ id: string }>;
  await dataSource.query(`UPDATE "user" SET "chatAccess" = true WHERE id = $1`, [existing!.id]);
  return existing!.id;
}

async function ensureEvalDecks(app: INestApplicationContext, dataSource: DataSource, userId: string): Promise<Map<TEvalDeckKey, number>> {
  const tracked = async (): Promise<Map<string, number>> =>
    new Map(
      ((await dataSource.query(`SELECT id, "fabraryUlid" FROM tracked_deck WHERE "userId" = $1`, [userId])) as Array<{ id: number; fabraryUlid: string }>).map(
        (deck) => [deck.fabraryUlid, deck.id],
      ),
    );
  const ulidOf = (url: string): string => url.split('/').pop()!;
  const known = await tracked();
  const toImport = EVAL_DECKS.filter((deck) => !known.has(ulidOf(deck.url))).map((deck) => deck.url);
  if (toImport.length > 0) {
    for (const url of toImport) {
      await app.get(DecksImportService).run({ text: url, ownsCards: true }, { userId });
    }
  }
  const byUlid = await tracked();
  return new Map(EVAL_DECKS.map((deck) => [deck.key, byUlid.get(ulidOf(deck.url))!]));
}

// The eval spends more than one user's monthly budget; ageing its usage keeps every turn under the cap and its cost readable.
async function releaseBudget(dataSource: DataSource, userId: string): Promise<void> {
  await dataSource.query(`UPDATE chat_usage SET "createdAt" = "createdAt" - interval '40 days' WHERE "userId" = $1 AND "createdAt" > now() - interval '40 days'`, [
    userId,
  ]);
}

interface ITracedBody {
  candidates?: { finishReason?: string; content?: { parts?: { functionCall?: { name: string; args?: unknown } }[] } }[];
  choices?: { finish_reason?: string; message?: { tool_calls?: { function: { name: string; arguments: string } }[] } }[];
  error?: { message?: string };
}

function traceOf(body: ITracedBody | null): Pick<IModelCallTrace, 'finishReason' | 'toolCalls'> {
  const shown = (name: string, args: string): string => `${name}(${args.slice(0, TOOL_ARGS_SHOWN)})`;
  const choice = body?.choices?.[0];
  if (choice) {
    return {
      finishReason: choice.finish_reason ?? null,
      toolCalls: (choice.message?.tool_calls ?? []).map((call) => shown(call.function.name, call.function.arguments)),
    };
  }
  const candidate = body?.candidates?.[0];
  return {
    finishReason: candidate?.finishReason ?? null,
    toolCalls: (candidate?.content?.parts ?? []).flatMap((part) =>
      part.functionCall ? [shown(part.functionCall.name, JSON.stringify(part.functionCall.args ?? {}))] : [],
    ),
  };
}

function tracingFetch(calls: IModelCallTrace[]): TGeminiFetch {
  return async (url, init) => {
    const startedAt = Date.now();
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as ITracedBody | null;
    calls.push({ ms: Date.now() - startedAt, status: response.status, ...traceOf(body), error: body?.error?.message ?? null });
    return { ok: response.ok, status: response.status, json: async () => body };
  };
}

interface ISentTurn {
  readonly scenario: IEvalScenario;
  readonly run: number;
  readonly messageId: string;
  readonly sentAt: number;
}

interface IDriveOptions {
  readonly apiKey: string;
  readonly openRouterModel: string | undefined;
  readonly workers: number;
  readonly maxUsd: number;
  readonly messageIds: readonly string[];
}

async function spentOn(dataSource: DataSource, messageIds: readonly string[]): Promise<number> {
  const [{ spent }] = (await dataSource.query(`SELECT COALESCE(sum("costUsd"), 0)::float8 AS spent FROM chat_usage WHERE "messageId" = ANY($1)`, [
    messageIds,
  ])) as [{ spent: number }];
  return spent;
}

async function driveTurns(app: INestApplicationContext, userId: string, options: IDriveOptions): Promise<Map<string, IModelCallTrace[]>> {
  const dataSource = app.get(DataSource);
  const queue = app.get(ChatTurnQueueService);
  const runner = app.get(ChatRunnerService);
  const traces = new Map<string, IModelCallTrace[]>();
  const thinkingLevel = parseThinkingLevel(process.env['GEMINI_CHAT_THINKING_LEVEL']);
  const logger = new Logger('ChatEval');
  const worker = async (): Promise<void> => {
    while (true) {
      const spent = await spentOn(dataSource, options.messageIds);
      if (spent >= options.maxUsd) {
        logger.warn(`stopped: $${spent.toFixed(4)} spent, the cap is $${options.maxUsd}`);
        return;
      }
      await releaseBudget(dataSource, userId);
      const turn = await queue.claimNext();
      if (!turn) return;
      const calls: IModelCallTrace[] = [];
      traces.set(turn.id, calls);
      await runner.process(turn, { apiKey: options.apiKey, openRouterModel: options.openRouterModel, fetch: tracingFetch(calls), thinkingLevel });
    }
  };
  await Promise.all(Array.from({ length: options.workers }, worker));
  return traces;
}

// A turn left pending would be claimed by the next eval or by any worker on the same database.
async function closeOpenTurns(dataSource: DataSource, userId: string): Promise<void> {
  await dataSource.query(
    `UPDATE chat_message SET status = 'failed', error = 'WORKER_LOST' WHERE status IN ('pending', 'running')
       AND "conversationId" IN (SELECT id FROM chat_conversation WHERE "userId" = $1)`,
    [userId],
  );
}

async function observeTurns(dataSource: DataSource, userId: string, messageIds: readonly string[]): Promise<void> {
  const deadline = Date.now() + TURN_WAIT_MS * messageIds.length;
  while (Date.now() < deadline) {
    await releaseBudget(dataSource, userId);
    const [{ open }] = (await dataSource.query(`SELECT count(*)::int AS open FROM chat_message WHERE id = ANY($1) AND status IN ('pending', 'running')`, [
      messageIds,
    ])) as [{ open: number }];
    if (open === 0) return;
    await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_MS));
  }
}

async function readRun(dataSource: DataSource, sent: ISentTurn, calls: readonly IModelCallTrace[]): Promise<IEvalRun> {
  const [message] = (await dataSource.query(
    `SELECT status, error, text, EXTRACT(EPOCH FROM ("finishedAt" - "startedAt")) * 1000 AS ms FROM chat_message WHERE id = $1`,
    [sent.messageId],
  )) as Array<{ status: string; error: string | null; text: string | null; ms: number | null }>;
  const [usage] = (await dataSource.query(
    `SELECT max(model) AS model, COALESCE(sum("costUsd"), 0)::float8 AS cost, COALESCE(sum("inputTokens"), 0)::int AS input,
            COALESCE(sum("cachedInputTokens"), 0)::int AS cached, COALESCE(sum("outputTokens"), 0)::int AS output
       FROM chat_usage WHERE "messageId" = $1`,
    [sent.messageId],
  )) as Array<{ model: string | null; cost: number; input: number; cached: number; output: number }>;
  const swaps = (
    (await dataSource.query(`SELECT payload FROM chat_proposal WHERE "messageId" = $1 AND kind = 'swap' ORDER BY "createdAt"`, [sent.messageId])) as Array<{
      payload: { originalCardIdentifier: string; replacementCardIdentifier: string };
    }>
  ).map(({ payload }) => ({ original: payload.originalCardIdentifier, replacement: payload.replacementCardIdentifier }));
  const done = message!.status === 'done';
  const check = sent.scenario.check
    ? { failure: done ? sent.scenario.check({ text: message!.text ?? '', toolCalls: calls.flatMap((call) => call.toolCalls), swaps }) : 'turn not done' }
    : null;
  return {
    scenario: sent.scenario.id,
    run: sent.run,
    question: sent.scenario.question,
    model: usage!.model,
    status: message!.status,
    error: message!.error,
    turnMs: Math.round(Number(message!.ms ?? 0)),
    costUsd: usage!.cost,
    inputTokens: usage!.input,
    cachedInputTokens: usage!.cached,
    outputTokens: usage!.output,
    calls,
    text: message!.text,
    swaps,
    check,
  };
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]!;
}

export function renderReport(runs: readonly IEvalRun[]): string {
  const done = runs.filter((run) => run.status === 'done');
  const spent = runs.reduce((sum, run) => sum + run.costUsd, 0);
  const input = runs.reduce((sum, run) => sum + run.inputTokens, 0);
  const cached = runs.reduce((sum, run) => sum + run.cachedInputTokens, 0);
  const models = [...new Set(runs.map((run) => run.model).filter((model): model is string => model !== null))];
  const checked = runs.filter((run) => run.check !== null);
  const passed = checked.filter((run) => run.check!.failure === null);
  const checkCell = (run: IEvalRun): string => (run.check === null ? '-' : run.check.failure === null ? 'pass' : `fail: ${run.check.failure}`);
  const lines = [
    `# Tutor eval${models.length > 0 ? `: ${models.join(', ')}` : ''}`,
    '',
    `${done.length}/${runs.length} turns done, $${spent.toFixed(4)} spent, $${(done.length === 0 ? 0 : spent / done.length).toFixed(4)} per done turn.`,
    `Turn time median ${percentile(done.map((run) => run.turnMs), 0.5)} ms, 90th percentile ${percentile(done.map((run) => run.turnMs), 0.9)} ms.`,
    `Model calls per turn ${(runs.reduce((sum, run) => sum + run.calls.length, 0) / Math.max(1, runs.length)).toFixed(1)}; ${input === 0 ? 0 : Math.round((cached / input) * 100)}% of ${input} input tokens came from the cache.`,
    `Checks: ${passed.length}/${checked.length} passed.`,
    '',
    '| Scenario | Run | Status | Check | Calls | Tools | Slowest call | Turn | Cost |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...runs.map(
      (run) =>
        `| ${run.scenario} | ${run.run} | ${run.status}${run.error ? ` ${run.error}` : ''} | ${checkCell(run)} | ${run.calls.length} | ${run.calls.flatMap((call) => call.toolCalls).join(', ')} | ${Math.max(0, ...run.calls.map((call) => call.ms))} ms | ${run.turnMs} ms | $${run.costUsd.toFixed(4)} |`,
    ),
    '',
    ...runs.flatMap((run) => [`## ${run.scenario} #${run.run}`, '', `> ${run.question}`, '', run.text ?? `_${run.status} ${run.error ?? ''}_`, '']),
  ];
  return lines.join('\n');
}

/**
 * `chat:eval [--model openrouter/id] [--max-usd N] [--runs N] [--concurrency N] [--only id,id] [--scenarios file.json] [--observe] [--out path]`:
 * real model turns through the real runner and tools; Gemini with GEMINI_API_KEY, or the OpenRouter model with OPENROUTER_API_KEY.
 */
async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const keyName = options.model ? 'OPENROUTER_API_KEY' : 'GEMINI_API_KEY';
  const apiKey = process.env[keyName]?.trim();
  if (options.drive && !apiKey) {
    console.error(`chat:eval needs ${keyName} to drive turns; pass --observe to let a running worker answer them`);
    process.exit(1);
  }
  const { AppModule } = await import('../../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const dataSource = app.get(DataSource);
  const chat = app.get(ChatService);
  const userId = await ensureEvalUser(dataSource);
  await closeOpenTurns(dataSource, userId);
  const decks = await ensureEvalDecks(app, dataSource, userId);
  await releaseBudget(dataSource, userId);
  const scenarios = [...EVAL_SCENARIOS, ...options.extra].filter((scenario) => options.only.length === 0 || options.only.includes(scenario.id));
  const sent: ISentTurn[] = [];
  for (const scenario of scenarios) {
    for (let run = 1; run <= options.runs; run += 1) {
      const conversation = await chat.create(userId, scenario.deck === null ? undefined : decks.get(scenario.deck));
      const { assistantMessageId } = await chat.send(userId, conversation.id, scenario.question, scenario.locale);
      sent.push({ scenario, run, messageId: assistantMessageId, sentAt: Date.now() });
    }
  }
  const messageIds = sent.map((turn) => turn.messageId);
  const traces = options.drive
    ? await driveTurns(app, userId, { apiKey: apiKey!, openRouterModel: options.model, workers: options.concurrency, maxUsd: options.maxUsd, messageIds })
    : (await observeTurns(dataSource, userId, messageIds), new Map<string, IModelCallTrace[]>());
  const runs = await Promise.all(sent.map((turn) => readRun(dataSource, turn, traces.get(turn.messageId) ?? [])));
  await closeOpenTurns(dataSource, userId);
  writeFileSync(`${options.out}.json`, JSON.stringify(runs, null, 2));
  writeFileSync(`${options.out}.md`, renderReport(runs));
  new Logger('ChatEval').warn(`${runs.filter((run) => run.status === 'done').length}/${runs.length} done; report at ${options.out}.md`);
  await app.close();
  process.exit(runs.every((run) => run.status === 'done' && (run.check === null || run.check.failure === null)) ? 0 : 1);
}

if (require.main === module) {
  void main();
}

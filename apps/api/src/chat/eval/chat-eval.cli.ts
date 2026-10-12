import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readFileSync, writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { DecksImportService } from '../../decks/import/decks-import.service';
import { parseThinkingLevel, TGeminiFetch } from '../../recommendations/gemini-client';
import { ChatRunnerService } from '../chat-runner.service';
import { ChatTurnQueueService } from '../chat-turn-queue.service';
import { ChatService } from '../chat.service';
import { EVAL_DECKS, EVAL_SCENARIOS, IEvalScenario, TEvalDeckKey } from './chat-eval-scenarios';

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
  readonly status: string;
  readonly error: string | null;
  readonly turnMs: number;
  readonly costUsd: number;
  readonly calls: readonly IModelCallTrace[];
  readonly text: string | null;
}

interface IEvalOptions {
  readonly runs: number;
  readonly concurrency: number;
  readonly only: readonly string[];
  readonly drive: boolean;
  readonly out: string;
  readonly extra: readonly IEvalScenario[];
}

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
    const result = await app.get(DecksImportService).run({ urls: toImport, seedInventory: true }, { userId });
    if (result.errors.length > 0) throw new Error(`eval deck import failed: ${JSON.stringify(result.errors)}`);
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

function tracingFetch(calls: IModelCallTrace[]): TGeminiFetch {
  return async (url, init) => {
    const startedAt = Date.now();
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as {
      candidates?: { finishReason?: string; content?: { parts?: { functionCall?: { name: string; args?: unknown } }[] } }[];
      error?: { message?: string };
    } | null;
    const candidate = body?.candidates?.[0];
    calls.push({
      ms: Date.now() - startedAt,
      status: response.status,
      finishReason: candidate?.finishReason ?? null,
      toolCalls: (candidate?.content?.parts ?? []).flatMap((part) =>
        part.functionCall ? [`${part.functionCall.name}(${JSON.stringify(part.functionCall.args ?? {}).slice(0, TOOL_ARGS_SHOWN)})`] : [],
      ),
      error: response.ok ? null : (body?.error?.message ?? null),
    });
    return { ok: response.ok, status: response.status, json: async () => body };
  };
}

interface ISentTurn {
  readonly scenario: IEvalScenario;
  readonly run: number;
  readonly messageId: string;
  readonly sentAt: number;
}

async function driveTurns(app: INestApplicationContext, userId: string, apiKey: string, workers: number): Promise<Map<string, IModelCallTrace[]>> {
  const dataSource = app.get(DataSource);
  const queue = app.get(ChatTurnQueueService);
  const runner = app.get(ChatRunnerService);
  const traces = new Map<string, IModelCallTrace[]>();
  const thinkingLevel = parseThinkingLevel(process.env['GEMINI_THINKING_LEVEL']);
  const worker = async (): Promise<void> => {
    while (true) {
      await releaseBudget(dataSource, userId);
      const turn = await queue.claimNext();
      if (!turn) return;
      const calls: IModelCallTrace[] = [];
      traces.set(turn.id, calls);
      await runner.process(turn, { apiKey, fetch: tracingFetch(calls), thinkingLevel });
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  return traces;
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
  const [{ cost }] = (await dataSource.query(`SELECT COALESCE(sum("costUsd"), 0)::float8 AS cost FROM chat_usage WHERE "messageId" = $1`, [
    sent.messageId,
  ])) as [{ cost: number }];
  return {
    scenario: sent.scenario.id,
    run: sent.run,
    question: sent.scenario.question,
    status: message!.status,
    error: message!.error,
    turnMs: Math.round(Number(message!.ms ?? 0)),
    costUsd: cost,
    calls,
    text: message!.text,
  };
}

export function renderReport(runs: readonly IEvalRun[]): string {
  const done = runs.filter((run) => run.status === 'done').length;
  const lines = [
    `# Tutor eval`,
    '',
    `${done}/${runs.length} turns done, $${runs.reduce((sum, run) => sum + run.costUsd, 0).toFixed(4)} spent.`,
    '',
    '| Scenario | Run | Status | Calls | Tools | Slowest call | Turn |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...runs.map(
      (run) =>
        `| ${run.scenario} | ${run.run} | ${run.status}${run.error ? ` ${run.error}` : ''} | ${run.calls.length} | ${run.calls.flatMap((call) => call.toolCalls).join(', ')} | ${Math.max(0, ...run.calls.map((call) => call.ms))} ms | ${run.turnMs} ms |`,
    ),
    '',
    ...runs.flatMap((run) => [`## ${run.scenario} #${run.run}`, '', `> ${run.question}`, '', run.text ?? `_${run.status} ${run.error ?? ''}_`, '']),
  ];
  return lines.join('\n');
}

/** `chat:eval [--runs N] [--concurrency N] [--only id,id] [--scenarios file.json] [--observe] [--out path]`: real Gemini turns through the real runner and tools. */
async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const apiKey = process.env['GEMINI_API_KEY']?.trim();
  if (options.drive && !apiKey) {
    console.error('chat:eval needs GEMINI_API_KEY to drive turns; pass --observe to let a running worker answer them');
    process.exit(1);
  }
  const { AppModule } = await import('../../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const dataSource = app.get(DataSource);
  const chat = app.get(ChatService);
  const userId = await ensureEvalUser(dataSource);
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
  const traces = options.drive
    ? await driveTurns(app, userId, apiKey!, options.concurrency)
    : (await observeTurns(dataSource, userId, sent.map((turn) => turn.messageId)), new Map<string, IModelCallTrace[]>());
  const runs = await Promise.all(sent.map((turn) => readRun(dataSource, turn, traces.get(turn.messageId) ?? [])));
  writeFileSync(`${options.out}.json`, JSON.stringify(runs, null, 2));
  writeFileSync(`${options.out}.md`, renderReport(runs));
  new Logger('ChatEval').warn(`${runs.filter((run) => run.status === 'done').length}/${runs.length} done; report at ${options.out}.md`);
  await app.close();
  process.exit(runs.every((run) => run.status === 'done') ? 0 : 1);
}

if (require.main === module) {
  void main();
}

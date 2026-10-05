import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { test } from 'node:test';
import { catalog } from '../../../packages/engine/src';
import { createOpenRouterClient, dryRunLlm, readApiKey, resolveLlmClient, type TFetch } from '../lib/llm';
import { MODEL_CONFIGS } from '../lib/models.config';
import { buildPool } from '../lib/pool-filter';
import { runCandidate } from '../lib/run-candidate';
import type { IDeckFile, IRunFile, TCandidateName } from '../lib/types';
import { SPIKE_DIR, listFiles, runCli, tempDir } from './helpers';

const DECK: IDeckFile = {
  deck: 'TESTDECK',
  url: 'https://fabrary.net/decks/TESTDECK',
  name: 'Test',
  hero: 'dorinthea-ironsong',
  format: 'Classic Constructed',
  mainboard: ['snatch-red', 'sink-below-red', 'in-the-swing-red'].map((card) => ({ card, quantity: 3 })),
};
const POOL = buildPool(DECK, catalog);
const KEY = 'test-key-not-a-secret';
const LLM_CANDIDATES = MODEL_CONFIGS.map((c) => c.candidate);

function seedOut(): string {
  const out = tempDir();
  mkdirSync(join(out, 'decks'), { recursive: true });
  mkdirSync(join(out, 'pools'), { recursive: true });
  writeFileSync(join(out, 'decks', 'TESTDECK.json'), JSON.stringify(DECK));
  writeFileSync(join(out, 'pools', 'TESTDECK.json'), JSON.stringify(POOL));
  return out;
}

interface ICall {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: Record<string, any>;
}

interface IReply {
  readonly status?: number;
  readonly content?: string;
  readonly finishReason?: string;
  readonly refusal?: string | null;
  readonly error?: { message: string };
}

const goodContent = (): string =>
  JSON.stringify({ ranking: POOL.cards.slice(0, 25).map((card, i) => ({ card, reason: `reason ${i + 1}` })) });

/** An injected fetch standing in for OpenRouter: records every call and answers in the documented chat completion shape. */
function fakeFetch(reply: IReply = {}): { fetchImpl: TFetch; calls: ICall[] } {
  const calls: ICall[] = [];
  const fetchImpl: TFetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const status = reply.status ?? 200;
    const payload = reply.error
      ? { error: reply.error }
      : {
          choices: [{
            finish_reason: reply.finishReason ?? 'stop',
            message: { content: reply.content ?? goodContent(), refusal: reply.refusal ?? null },
          }],
          usage: {
            prompt_tokens: 40100,
            completion_tokens: 6900,
            cost: 0.0123,
            completion_tokens_details: { reasoning_tokens: 4000 },
          },
        };
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
  return { fetchImpl, calls };
}

test('C15: with the key unset no request is made and the CLI exits 1 without writing; no key sits in any file', () => {
  assert.equal(readApiKey({}), null);
  assert.equal(readApiKey({ OPENROUTER_API_KEY: '  ' }), null);
  assert.equal(readApiKey({ OPENROUTER_API_KEY: KEY }), KEY);

  for (const candidate of [...LLM_CANDIDATES, 'llm-all']) {
    const out = seedOut();
    const result = runCli('run.ts', [candidate], { SYNERGY_OUT_DIR: out, OPENROUTER_API_KEY: undefined });
    assert.equal(result.status, 1, candidate);
    assert.match(result.stderr, /OPENROUTER_API_KEY/);
    assert.deepEqual(listFiles(join(out, 'runs')), []);
  }

  const keyShape = /sk-or-[A-Za-z0-9_-]{8,}|OPENROUTER_API_KEY\s*=\s*\S/;
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? (name === 'out' || name === '__tests__' ? [] : walk(path)) : [path];
    });
  const files = [...walk(SPIKE_DIR), join(SPIKE_DIR, '..', '..', '.env.example')];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    assert.ok(!lines.some((l) => keyShape.test(l) && !l.trim().startsWith('#')), `${file} holds no key value`);
  }
});

test('C16: each candidate sends one request with its pinned model and the schema-enforced ranking prompt; the top 10 are kept', async () => {
  const expectedModels: Record<string, string> = {
    'gpt-6.1-sol': 'openai/gpt-6.1-sol',
    'gemini-3.8-flash': 'google/gemini-3.8-flash',
    'mimo-v2.6-pro': 'xiaomi/mimo-v2.6-pro',
    'opus-5.5': 'anthropic/claude-opus-5.5',
  };
  assert.deepEqual(Object.keys(expectedModels), LLM_CANDIDATES);

  for (const candidate of LLM_CANDIDATES) {
    const out = seedOut();
    const { fetchImpl, calls } = fakeFetch();

    const { runs } = await runCandidate({
      candidate, out, catalog, llm: createOpenRouterClient(KEY, fetchImpl),
    });

    assert.equal(calls.length, 1, candidate);
    const call = calls[0] as ICall;
    assert.equal(call.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(call.headers['Authorization'], `Bearer ${KEY}`);
    assert.equal(call.body['model'], expectedModels[candidate]);
    assert.equal(call.body['response_format'].type, 'json_schema');
    assert.equal(call.body['response_format'].json_schema.strict, true);
    assert.equal(call.body['provider'].require_parameters, true);
    assert.deepEqual(call.body['reasoning'], candidate === 'gpt-6.1-sol' || candidate === 'opus-5.5' ? { effort: 'high' } : undefined);

    const prompt = call.body['messages'].map((m: { content: string }) => m.content).join('\n');
    assert.ok(prompt.includes('Dorinthea Ironsong'));
    for (const id of DECK.mainboard.map((e) => e.card)) {
      assert.ok(prompt.includes(catalog.getCard(id).functionalText as string), `deck rules text of ${id}`);
    }
    for (const id of POOL.cards) assert.ok(prompt.includes(`${id} |`), `pool card ${id}`);
    assert.match(prompt, /Rank the 25 cards/);
    assert.match(prompt, /one sentence of reason/);

    const run = runs[0] as IRunFile;
    assert.equal(run.candidate, candidate);
    assert.equal(run.status, 'ok');
    assert.deepEqual(run.top10, POOL.cards.slice(0, 10));
    assert.equal(run.reasons?.[POOL.cards[0] as string], 'reason 1');
    const written = JSON.parse(readFileSync(join(out, 'runs', candidate, 'TESTDECK.json'), 'utf8')) as IRunFile;
    assert.deepEqual(written.top10, run.top10);
  }
});

test('C17: dry run prints a local estimate and a cost ceiling per candidate and deck, makes no call, needs no key', () => {
  const lines = dryRunLlm(MODEL_CONFIGS, [DECK], () => POOL, catalog);

  assert.match(lines[0] as string, /estimated locally/);
  assert.match(lines[0] as string, /no request was sent/);
  assert.equal(lines.length, 1 + 4);
  for (const candidate of LLM_CANDIDATES) {
    assert.ok(lines.some((l) => new RegExp(`^${candidate.replace(/\./g, '\\.')} TESTDECK Test: about \\d+ input tokens, at most \\d+\\.\\d\\d USD$`).test(l)), candidate);
  }

  const out = seedOut();
  const result = runCli('run.ts', ['llm-all', '--dry-run'], { SYNERGY_OUT_DIR: out, OPENROUTER_API_KEY: undefined });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /estimated locally/);
  assert.deepEqual(listFiles(join(out, 'runs')), []);
});

test('C18: the usage tokens, reasoning tokens and cost are stored in the run file', async () => {
  const out = seedOut();
  const { fetchImpl } = fakeFetch();
  await runCandidate({ candidate: 'mimo-v2.6-pro', out, catalog, llm: createOpenRouterClient(KEY, fetchImpl) });

  const run = JSON.parse(readFileSync(join(out, 'runs', 'mimo-v2.6-pro', 'TESTDECK.json'), 'utf8')) as IRunFile;
  assert.deepEqual(run.usage, { inputTokens: 40100, outputTokens: 6900, reasoningTokens: 4000, costUsd: 0.0123 });
});

test('C19: each of six failure triggers records a failed run, one request, no retry, exit 1', async () => {
  const triggers: [string, IReply, (run: IRunFile) => void][] = [
    ['length', { finishReason: 'length' }, (r) => assert.equal(r.stopReason, 'length')],
    ['content_filter', { finishReason: 'content_filter' }, (r) => assert.equal(r.stopReason, 'content_filter')],
    ['error', { finishReason: 'error' }, (r) => assert.equal(r.stopReason, 'error')],
    ['refusal', { refusal: 'I cannot help with that' }, (r) => assert.equal(r.stopReason, 'refusal')],
    ['http 429', { status: 429, error: { message: 'rate limited' } }, (r) => assert.match(r.error as string, /429.*rate limited/)],
    ['non-JSON content', { content: 'Here are my picks: ...' }, (r) => assert.match(r.error as string, /not the requested JSON/)],
  ];
  assert.equal(triggers.length, 6);

  for (const [name, reply, expectRun] of triggers) {
    const out = seedOut();
    const { fetchImpl, calls } = fakeFetch(reply);

    const { runs, exitCode } = await runCandidate({
      candidate: 'gemini-3.8-flash' as TCandidateName, out, catalog, llm: createOpenRouterClient(KEY, fetchImpl),
    });

    assert.equal(calls.length, 1, `${name}: no retry`);
    assert.equal(exitCode, 1, name);
    const run = runs[0] as IRunFile;
    assert.equal(run.status, 'failed', name);
    assert.equal(run.top10, undefined, name);
    expectRun(run);
  }
});

test('C15: with the key unset the injected fetch is called 0 times, and with it set a run calls it once per deck', async () => {
  const missing = fakeFetch();
  const client = resolveLlmClient({}, missing.fetchImpl);
  assert.equal(client, null);
  await assert.rejects(
    runCandidate({ candidate: 'gpt-6.1-sol', out: seedOut(), catalog, llm: client ?? undefined }),
    /needs a language-model client/,
  );
  assert.equal(missing.calls.length, 0);

  const present = fakeFetch();
  const live = resolveLlmClient({ OPENROUTER_API_KEY: KEY }, present.fetchImpl);
  assert.ok(live);
  await runCandidate({ candidate: 'gpt-6.1-sol', out: seedOut(), catalog, llm: live });
  assert.equal(present.calls.length, 1);
});

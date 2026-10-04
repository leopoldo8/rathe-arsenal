import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { test } from 'node:test';
import { catalog } from '../../../packages/engine/src';
import { createLlmClientFromEnv, dryRunLlm, type ILlmClient, type ILlmRequest, type ILlmResponse } from '../lib/llm';
import { buildPool } from '../lib/pool-filter';
import { runCandidate } from '../lib/run-candidate';
import type { IDeckFile, IRunFile } from '../lib/types';
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

function seedOut(): string {
  const out = tempDir();
  mkdirSync(join(out, 'decks'), { recursive: true });
  mkdirSync(join(out, 'pools'), { recursive: true });
  writeFileSync(join(out, 'decks', 'TESTDECK.json'), JSON.stringify(DECK));
  writeFileSync(join(out, 'pools', 'TESTDECK.json'), JSON.stringify(POOL));
  return out;
}

function fakeClient(response: Partial<ILlmResponse> = {}): ILlmClient & { requests: ILlmRequest[]; counts: ILlmRequest[] } {
  const requests: ILlmRequest[] = [];
  const counts: ILlmRequest[] = [];
  const ranking = POOL.cards.slice(0, 25).map((card, i) => ({ card, reason: `reason ${i + 1}` }));
  return {
    requests,
    counts,
    async countTokens(request) {
      counts.push(request);
      return 41234;
    },
    async generate(request) {
      requests.push(request);
      return {
        text: JSON.stringify({ ranking }),
        stopReason: 'end_turn',
        usage: { inputTokens: 40100, outputTokens: 2900 },
        ...response,
      };
    },
  };
}

test('C15: with the key unset the client is never built and the CLI exits 1 without writing; no key sits in any file', () => {
  let built = 0;
  const client = createLlmClientFromEnv({}, () => {
    built += 1;
    return fakeClient();
  });
  assert.equal(client, null);
  assert.equal(built, 0);

  const out = seedOut();
  const result = runCli('run.ts', ['llm'], { SYNERGY_OUT_DIR: out, ANTHROPIC_API_KEY: undefined });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ANTHROPIC_API_KEY/);
  assert.deepEqual(listFiles(join(out, 'runs')), []);

  const keyShape = /sk-ant-[A-Za-z0-9_-]{8,}|ANTHROPIC_API_KEY\s*=\s*\S/;
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

test('C16: one request per deck with the model, hero, deck rules text and the whole pool, asking for 25; the top 10 are kept', async () => {
  const out = seedOut();
  const client = fakeClient();

  const { runs } = await runCandidate({ candidate: 'llm', out, catalog, llm: client });

  assert.equal(client.requests.length, 1);
  const request = client.requests[0] as ILlmRequest;
  assert.equal(request.model, 'claude-opus-5-5');
  assert.ok(request.prompt.includes('Dorinthea Ironsong'));
  for (const id of DECK.mainboard.map((e) => e.card)) {
    const card = catalog.getCard(id);
    assert.ok(request.prompt.includes(card.functionalText as string), `deck rules text of ${id}`);
  }
  for (const id of POOL.cards) assert.ok(request.prompt.includes(`${id} |`), `pool card ${id}`);
  assert.match(request.prompt, /Rank the 25 cards/);
  assert.match(request.prompt, /one sentence of reason/);

  const run = runs[0] as IRunFile;
  assert.equal(run.status, 'ok');
  assert.deepEqual(run.top10, POOL.cards.slice(0, 10));
  assert.equal(run.reasons?.[POOL.cards[0] as string], 'reason 1');
});

test('C17: dry run prints one token count per deck and makes no generation call', async () => {
  const client = fakeClient();
  const lines = await dryRunLlm([DECK], () => POOL, catalog, client);

  assert.equal(lines.length, 1);
  assert.match(lines[0] as string, /TESTDECK.*41234 input tokens/);
  assert.equal(client.counts.length, 1);
  assert.equal(client.requests.length, 0);
});

test('C18: the usage input and output token counts are stored in the run file', async () => {
  const out = seedOut();
  await runCandidate({ candidate: 'llm', out, catalog, llm: fakeClient() });

  const run = JSON.parse(readFileSync(join(out, 'runs', 'llm', 'TESTDECK.json'), 'utf8')) as IRunFile;
  assert.deepEqual(run.usage, { inputTokens: 40100, outputTokens: 2900 });
});

test('C19: refusal and max_tokens each record a failed run with the stop reason, one request, exit 1', async () => {
  for (const stopReason of ['refusal', 'max_tokens']) {
    const out = seedOut();
    const client = fakeClient({ stopReason });

    const { runs, exitCode } = await runCandidate({ candidate: 'llm', out, catalog, llm: client });

    assert.equal(client.requests.length, 1, `${stopReason}: no retry`);
    assert.equal(exitCode, 1);
    const run = runs[0] as IRunFile;
    assert.equal(run.status, 'failed');
    assert.equal(run.stopReason, stopReason);
    assert.equal(run.top10, undefined);
  }
});

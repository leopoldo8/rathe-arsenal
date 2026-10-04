import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { test } from 'node:test';
import { catalog } from '../../../packages/engine/src';
import { finalizeTop10 } from '../lib/finalize';
import { buildPool } from '../lib/pool-filter';
import { exitCodeFor, toRunFile } from '../lib/run-candidate';
import type { IDeckFile, IRunFile } from '../lib/types';
import { SPIKE_DIR, runCli, tempDir } from './helpers';

const DECK: IDeckFile = {
  deck: 'TESTDECK',
  url: 'https://fabrary.net/decks/TESTDECK',
  name: 'Test',
  hero: 'dorinthea-ironsong',
  format: 'Classic Constructed',
  mainboard: [
    'snatch-red', 'sink-below-red', 'toughen-up-blue', 'warrior-s-valor-red', 'in-the-swing-red',
  ].filter((id) => catalog.indices.byIdentifier.has(id)).map((card) => ({ card, quantity: 3 })),
};

function seedOut(): string {
  const out = tempDir();
  mkdirSync(join(out, 'decks'), { recursive: true });
  mkdirSync(join(out, 'pools'), { recursive: true });
  writeFileSync(join(out, 'decks', 'TESTDECK.json'), JSON.stringify(DECK));
  writeFileSync(join(out, 'pools', 'TESTDECK.json'), JSON.stringify(buildPool(DECK, catalog)));
  return out;
}

test('C10: heuristic writes an ok run with exactly 10 distinct ranked cards from the pool and outside the deck', () => {
  const out = seedOut();
  const result = runCli('run.ts', ['heuristic'], { SYNERGY_OUT_DIR: out });

  assert.equal(result.status, 0, result.stderr);
  const run = JSON.parse(readFileSync(join(out, 'runs', 'heuristic', 'TESTDECK.json'), 'utf8')) as IRunFile;
  const pool = new Set(buildPool(DECK, catalog).cards);
  const inDeck = new Set(DECK.mainboard.map((e) => e.card));
  assert.equal(run.status, 'ok');
  assert.equal(run.top10?.length, 10);
  assert.equal(new Set(run.top10).size, 10);
  for (const id of run.top10 ?? []) {
    assert.ok(pool.has(id), `${id} in the pool`);
    assert.ok(!inDeck.has(id), `${id} not in the deck`);
  }
});

test('C11: ids outside the pool or in the deck are dropped, and under 10 left the run is failed with exit 1', () => {
  const pool = buildPool(DECK, catalog);
  const valid = pool.cards.slice(0, 10);
  const noise = ['not-a-real-card-xyz', 'snatch-red'];

  assert.deepEqual(finalizeTop10({ ranked: [...noise, ...valid], pool: new Set(pool.cards), inDeck: new Set(['snatch-red']) }), valid);
  assert.equal(finalizeTop10({ ranked: [...noise, ...valid.slice(0, 9)], pool: new Set(pool.cards), inDeck: new Set(['snatch-red']) }), null);

  const ok = toRunFile(DECK, pool, 'heuristic', [...noise, ...valid]);
  const failed = toRunFile(DECK, pool, 'heuristic', [...noise, ...valid.slice(0, 9)]);
  assert.equal(ok.status, 'ok');
  assert.equal(failed.status, 'failed');
  assert.equal('top10' in failed, false);
  assert.equal(exitCodeFor([ok, failed]), 1);
  assert.equal(exitCodeFor([ok]), 0);
});

test('C12: heuristic run twice writes byte-identical files', () => {
  const out = seedOut();
  const file = join(out, 'runs', 'heuristic', 'TESTDECK.json');

  runCli('run.ts', ['heuristic'], { SYNERGY_OUT_DIR: out });
  const first = readFileSync(file);
  runCli('run.ts', ['heuristic'], { SYNERGY_OUT_DIR: out });
  const second = readFileSync(file);

  assert.ok(first.equals(second));
});

test('C13: no committed judging sheet holds a verdict, so the heuristic formula was fixed first', () => {
  const sheet = join(SPIKE_DIR, 'out', 'judging-sheet.csv');
  if (existsSync(sheet)) {
    const rows = parse(readFileSync(sheet, 'utf8'), { columns: true }) as { verdict: string }[];
    assert.ok(rows.every((row) => row.verdict === ''), 'every verdict cell is empty');
  }
  const header = readFileSync(join(SPIKE_DIR, 'candidates', 'heuristic.ts'), 'utf8').slice(0, 600);
  assert.match(header, /must not change afterwards/);
  const status = execFileSync('git', ['status', '--porcelain', '--', 'scripts/synergy-spike/candidates/heuristic.ts'], { encoding: 'utf8' });
  assert.equal(status, '', 'the formula file has no uncommitted change');
});

test('C14: cooccurrence with 0 decklists found writes untestable with found 0 and exits 0', () => {
  const out = seedOut();
  const result = runCli('run.ts', ['cooccurrence'], { SYNERGY_OUT_DIR: out });

  assert.equal(result.status, 0, result.stderr);
  const run = JSON.parse(readFileSync(join(out, 'runs', 'cooccurrence', 'TESTDECK.json'), 'utf8')) as IRunFile;
  assert.equal(run.status, 'untestable');
  assert.equal(run.found, 0);
  assert.equal(run.minimum, 20);
});

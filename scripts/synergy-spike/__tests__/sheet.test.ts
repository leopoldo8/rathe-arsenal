import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { test } from 'node:test';
import { catalog } from '../../../packages/engine/src';
import { buildPool } from '../lib/pool-filter';
import type { IDeckFile, IRunFile, TCandidateName } from '../lib/types';
import { runCli, tempDir } from './helpers';

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
  writeFileSync(join(out, 'decks', 'TESTDECK.json'), JSON.stringify(DECK));
  return out;
}

function writeRun(out: string, candidate: TCandidateName, offset: number): string[] {
  const top10 = POOL.cards.slice(offset, offset + 10);
  const run: IRunFile = { deck: 'TESTDECK', candidate, status: 'ok', top10 };
  mkdirSync(join(out, 'runs', candidate), { recursive: true });
  writeFileSync(join(out, 'runs', candidate, 'TESTDECK.json'), JSON.stringify(run));
  return top10;
}

function readRows(out: string): Record<string, string>[] {
  return parse(readFileSync(join(out, 'judging-sheet.csv'), 'utf8'), { columns: true }) as Record<string, string>[];
}

test('C21: the sheet has the six columns, one row per distinct (deck, card), an empty verdict and no candidate or rank', () => {
  const out = seedOut();
  const llm = writeRun(out, 'llm', 0);
  const heuristic = writeRun(out, 'heuristic', 5);

  const result = runCli('sheet.ts', [], { SYNERGY_OUT_DIR: out });

  assert.equal(result.status, 0, result.stderr);
  const text = readFileSync(join(out, 'judging-sheet.csv'), 'utf8');
  assert.equal(text.split('\n')[0], 'deck,hero,card,pitch,rules,verdict');
  const rows = readRows(out);
  assert.equal(rows.length, new Set([...llm, ...heuristic]).size);
  assert.equal(rows.length, 15);
  assert.equal(new Set(rows.map((r) => `${r['deck']}|${r['card']}`)).size, 15);
  for (const row of rows) {
    assert.equal(row['verdict'], '');
    assert.equal(row['hero'], 'Dorinthea Ironsong');
    for (const [column, value] of Object.entries(row)) {
      if (column === 'rules') continue;
      assert.ok(!/^(llm|heuristic|cooccurrence|rank.*)$/i.test(value), `${column} names a candidate or rank`);
    }
  }
});

test('C22: row order is a seeded shuffle and the key maps each card to its candidates and ranks, including shared cards', () => {
  const first = seedOut();
  const second = seedOut();
  for (const out of [first, second]) {
    writeRun(out, 'llm', 0);
    writeRun(out, 'heuristic', 5);
    runCli('sheet.ts', [], { SYNERGY_OUT_DIR: out });
  }

  assert.deepEqual(readRows(first).map((r) => r['card']), readRows(second).map((r) => r['card']));
  assert.notDeepEqual(readRows(first).map((r) => r['card']), [...readRows(first).map((r) => r['card'])].sort());

  const key = JSON.parse(readFileSync(join(first, 'judging-key.json'), 'utf8')) as {
    deck: string; card: string; runs: { candidate: string; rank: number }[];
  }[];
  const shared = key.find((e) => e.card === POOL.cards[7]);
  assert.deepEqual(shared?.runs, [
    { candidate: 'llm', rank: 8 },
    { candidate: 'heuristic', rank: 3 },
  ]);
  const llmOnly = key.find((e) => e.card === POOL.cards[0]);
  assert.deepEqual(llmOnly?.runs, [{ candidate: 'llm', rank: 1 }]);
});

test('C23: a rebuild keeps filled verdicts, adds only new pairs and repeats no row', () => {
  const out = seedOut();
  writeRun(out, 'llm', 0);
  runCli('sheet.ts', [], { SYNERGY_OUT_DIR: out });

  const rows = readRows(out);
  const judged = rows.map((r, i) => (i < 2 ? { ...r, verdict: i === 0 ? 'yes' : 'no' } : r));
  writeFileSync(
    join(out, 'judging-sheet.csv'),
    stringify(judged, { header: true, columns: ['deck', 'hero', 'card', 'pitch', 'rules', 'verdict'] }),
  );

  writeRun(out, 'heuristic', 5);
  runCli('sheet.ts', [], { SYNERGY_OUT_DIR: out });

  const rebuilt = readRows(out);
  assert.equal(rebuilt.length, 15);
  assert.equal(rebuilt[0]?.['verdict'], 'yes');
  assert.equal(rebuilt[1]?.['verdict'], 'no');
  assert.deepEqual(rebuilt.slice(0, 10).map((r) => r['card']), rows.map((r) => r['card']));
  assert.equal(new Set(rebuilt.map((r) => r['card'])).size, 15);
});

import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { test } from 'node:test';
import { catalog, Class } from '../../../packages/engine/src';
import { rankHeuristic } from '../candidates/heuristic';
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

test('C10: the ranking is best first, cards that match the hero on class and keywords come before generic cards with neither', () => {
  const pool = buildPool(DECK, catalog);
  const cards = pool.cards.map((id) => catalog.getCard(id));
  const strong = cards.filter((c) => c.classes.includes(Class.Warrior) && c.keywords.length > 0).slice(0, 6);
  const weak = cards
    .filter((c) => c.classes.length === 1 && c.classes.includes(Class.Generic) && c.keywords.length === 0 && c.talents.length === 0)
    .slice(0, 6);
  assert.equal(strong.length, 6);
  assert.equal(weak.length, 6);
  const small = {
    ...pool,
    cards: [...weak, ...strong].map((c) => c.cardIdentifier),
    size: 12,
  };

  const ranked = rankHeuristic(DECK, small, catalog);

  const strongIds = new Set(strong.map((c) => c.cardIdentifier));
  assert.ok(strongIds.has(ranked[0] as string), 'rank 1 is a strong card');
  assert.deepEqual(new Set(ranked.slice(0, 6)), strongIds, 'the six strong cards fill ranks 1 to 6');
  assert.deepEqual(new Set(ranked.slice(6)), new Set(weak.map((c) => c.cardIdentifier)));
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

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', cwd: join(SPIKE_DIR, '..', '..') });
}

const SHEET = 'scripts/synergy-spike/out/judging-sheet.csv';
const FORMULA = 'scripts/synergy-spike/candidates/heuristic.ts';

test('C13: the heuristic formula has no commit after the first commit that wrote a verdict to the sheet', () => {
  const firstVerdictCommit = git('log', '--reverse', '--format=%H', '--', SHEET)
    .split('\n')
    .filter((sha) => sha !== '')
    .find((sha) => {
      const rows = parse(git('show', `${sha}:${SHEET}`), { columns: true }) as { verdict: string }[];
      return rows.some((row) => row.verdict.trim() !== '');
    });

  if (firstVerdictCommit !== undefined) {
    const after = git('log', '--format=%h %s', `${firstVerdictCommit}..HEAD`, '--', FORMULA).trim();
    assert.equal(after, '', `the formula changed after verdicts existed: ${after}`);
  }

  const header = readFileSync(join(SPIKE_DIR, 'candidates', 'heuristic.ts'), 'utf8').slice(0, 600);
  assert.match(header, /must not change afterwards/);
  assert.equal(git('status', '--porcelain', '--', FORMULA), '', 'the formula file has no uncommitted change');
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

test('C11: the CLI records a failed run and exits 1 when fewer than 10 valid cards remain', () => {
  const out = seedOut();
  const pool = buildPool(DECK, catalog);
  writeFileSync(
    join(out, 'pools', 'TESTDECK.json'),
    JSON.stringify({ ...pool, cards: pool.cards.slice(0, 9), size: 9 }),
  );

  const result = runCli('run.ts', ['heuristic'], { SYNERGY_OUT_DIR: out });

  assert.equal(result.status, 1);
  const run = JSON.parse(readFileSync(join(out, 'runs', 'heuristic', 'TESTDECK.json'), 'utf8')) as IRunFile;
  assert.equal(run.status, 'failed');
  assert.equal('top10' in run, false);
});

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'csv-stringify/sync';
import { test } from 'node:test';
import type { IRunFile, TCandidateName } from '../lib/types';
import { runCli, tempDir } from './helpers';

const DECKS = ['DECKA', 'DECKB', 'DECKC'];
const cardsFor = (candidate: string, deck: string): string[] =>
  Array.from({ length: 10 }, (_, i) => `${candidate}-${deck}-card-${i + 1}`.toLowerCase());

interface IScenarioRun {
  readonly candidate: TCandidateName;
  readonly deck: string;
  readonly yes: number;
  readonly status?: IRunFile['status'];
  readonly extra?: Partial<IRunFile>;
}

/** `yes` of the 10 cards of a run are judged yes, the rest no. */
function scenario(runs: IScenarioRun[], overrides: Record<string, string> = {}): string {
  const out = tempDir();
  mkdirSync(join(out, 'decks'), { recursive: true });
  for (const deck of DECKS) {
    writeFileSync(join(out, 'decks', `${deck}.json`), JSON.stringify({
      deck, url: '', name: deck, hero: 'dorinthea-ironsong', format: 'Classic Constructed', mainboard: [],
    }));
  }
  const rows: Record<string, string>[] = [];
  for (const { candidate, deck, yes, status = 'ok', extra = {} } of runs) {
    const top10 = cardsFor(candidate, deck);
    const run: IRunFile = status === 'ok'
      ? { deck, candidate, status, top10, ...extra }
      : { deck, candidate, status, ...extra };
    mkdirSync(join(out, 'runs', candidate), { recursive: true });
    writeFileSync(join(out, 'runs', candidate, `${deck}.json`), JSON.stringify(run));
    if (status !== 'ok') continue;
    top10.forEach((card, i) => {
      rows.push({
        deck, hero: 'Dorinthea Ironsong', card, pitch: '1', rules: '',
        verdict: overrides[card] ?? (i < yes ? 'yes' : 'no'),
      });
    });
  }
  writeFileSync(
    join(out, 'judging-sheet.csv'),
    stringify(rows, { header: true, columns: ['deck', 'hero', 'card', 'pitch', 'rules', 'verdict'] }),
  );
  return out;
}

const score = (out: string): { status: number | null; stderr: string; result: string | null } => {
  const r = runCli('score.ts', [], { SYNERGY_OUT_DIR: out });
  const path = join(out, 'result.md');
  return { status: r.status, stderr: r.stderr, result: existsSync(path) ? readFileSync(path, 'utf8') : null };
};

const allDecks = (candidate: TCandidateName, yes: number): IScenarioRun[] =>
  DECKS.map((deck) => ({ candidate, deck, yes }));

test('C24: a blank, maybe or missing verdict exits 1 with the count and writes no result; YES and no pass in any case', () => {
  const blank = score(scenario(allDecks('llm', 5), { 'llm-decka-card-1': '' }));
  assert.equal(blank.status, 1);
  assert.match(blank.stderr, /1 top-10 card/);
  assert.equal(blank.result, null);

  const maybe = score(scenario(allDecks('llm', 5), { 'llm-decka-card-1': 'maybe', 'llm-deckb-card-2': 'maybe' }));
  assert.equal(maybe.status, 1);
  assert.match(maybe.stderr, /2 top-10 card/);
  assert.equal(maybe.result, null);

  const missingOut = scenario(allDecks('llm', 5));
  writeFileSync(join(missingOut, 'judging-sheet.csv'), 'deck,hero,card,pitch,rules,verdict\n');
  const missing = score(missingOut);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /30 top-10 card/);

  const cased = score(scenario(allDecks('llm', 5), { 'llm-decka-card-1': 'YES', 'llm-decka-card-10': 'No' }));
  assert.equal(cased.status, 0, cased.stderr);
});

test('C25: result.md counts yes per candidate and deck, with 5 PASS and 4 FAIL', () => {
  const run = score(scenario([
    { candidate: 'llm', deck: 'DECKA', yes: 5 },
    { candidate: 'llm', deck: 'DECKB', yes: 4 },
    { candidate: 'llm', deck: 'DECKC', yes: 10 },
  ]));

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.result as string, /\| llm \| DECKA \| Dorinthea Ironsong \| 5 \| PASS \|/);
  assert.match(run.result as string, /\| llm \| DECKB \| Dorinthea Ironsong \| 4 \| FAIL \|/);
  assert.match(run.result as string, /\| llm \| DECKC \| Dorinthea Ironsong \| 10 \| PASS \|/);
});

test('C26: PASS on 3 decks writes the STOP line for that candidate, PASS on 2 does not', () => {
  const three = score(scenario(allDecks('llm', 6)));
  assert.match(three.result as string, /^STOP: llm passed on 3 decks$/m);

  const two = score(scenario([
    { candidate: 'llm', deck: 'DECKA', yes: 6 },
    { candidate: 'llm', deck: 'DECKB', yes: 6 },
    { candidate: 'llm', deck: 'DECKC', yes: 4 },
  ]));
  assert.doesNotMatch(two.result as string, /passed on 3 decks/);
});

test('C27: with all three candidates run and none passing on 3 decks the result says all were tried', () => {
  const run = score(scenario([
    ...allDecks('llm', 3),
    ...allDecks('heuristic', 4),
    ...DECKS.map((deck): IScenarioRun => ({ candidate: 'cooccurrence', deck, yes: 0, status: 'untestable', extra: { found: 0, minimum: 20 } })),
  ]));

  assert.match(run.result as string, /^STOP: all candidates tried once, none passed$/m);
  assert.doesNotMatch(run.result as string, /CONTINUE/);
});

test('C28: the CONTINUE line names the next candidate in the agreed order', () => {
  const afterLlm = score(scenario(allDecks('llm', 3)));
  assert.match(afterLlm.result as string, /^CONTINUE: next candidate is heuristic$/m);

  const afterTwo = score(scenario([...allDecks('llm', 3), ...allDecks('heuristic', 3)]));
  assert.match(afterTwo.result as string, /^CONTINUE: next candidate is cooccurrence$/m);
});

test('C29: an untestable or failed deck shows its status in place of a count and counts as tried', () => {
  const run = score(scenario([
    { candidate: 'llm', deck: 'DECKA', yes: 0, status: 'failed', extra: { stopReason: 'refusal' } },
    { candidate: 'llm', deck: 'DECKB', yes: 0, status: 'failed', extra: { stopReason: 'max_tokens' } },
    { candidate: 'llm', deck: 'DECKC', yes: 0, status: 'untestable', extra: { found: 0, minimum: 20 } },
  ]));

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.result as string, /\| llm \| DECKA \| Dorinthea Ironsong \| failed \(refusal\) \| - \|/);
  assert.match(run.result as string, /\| llm \| DECKB \| Dorinthea Ironsong \| failed \(max_tokens\) \| - \|/);
  assert.match(run.result as string, /\| llm \| DECKC \| Dorinthea Ironsong \| untestable \(found 0 of 20 decklists needed\) \| - \|/);
  assert.match(run.result as string, /^CONTINUE: next candidate is heuristic$/m);
});

test('C30: the result prints the total input and output tokens the llm candidate used', () => {
  const run = score(scenario(DECKS.map((deck, i): IScenarioRun => ({
    candidate: 'llm', deck, yes: 3, extra: { usage: { inputTokens: 40000 + i, outputTokens: 3000 + i } },
  }))));

  assert.match(run.result as string, /llm tokens used: 120003 input, 9003 output/);
});

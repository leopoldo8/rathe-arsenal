import type { ICatalog } from '../../../packages/engine/src';
import { readDecks, readRuns } from './io';
import { readSheet } from './sheet';
import {
  CANDIDATE_ORDER,
  REQUIRED_DECK_COUNT,
  type IDeckFile,
  type IRunFile,
  type TCandidateName,
} from './types';

export const PASS_THRESHOLD = 5;

export type TScoreResult =
  | { readonly ok: true; readonly markdown: string }
  | { readonly ok: false; readonly invalid: number };

interface IDeckScore {
  readonly deck: IDeckFile;
  readonly run: IRunFile;
  readonly yes: number;
}

type TVerdict = 'yes' | 'no' | 'invalid';

function normalize(raw: string | undefined): TVerdict {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'yes' || value === 'no' ? value : 'invalid';
}

function describeStatus(run: IRunFile): string {
  if (run.status === 'untestable') return `untestable (found ${run.found ?? 0} of ${run.minimum ?? 0} decklists needed)`;
  return `failed${run.stopReason ? ` (${run.stopReason})` : run.error ? ` (${run.error})` : ''}`;
}

export function scoreAll(out: string, catalog: ICatalog): TScoreResult {
  const decks = readDecks(out);
  const verdicts = new Map(readSheet(out).map((r) => [`${r.deck}\u0000${r.card}`, normalize(r.verdict)]));
  const heroName = (deck: IDeckFile): string => {
    try {
      return catalog.getCard(deck.hero).name;
    } catch {
      return deck.hero;
    }
  };

  const byCandidate = new Map<TCandidateName, IDeckScore[]>();
  let invalid = 0;
  for (const candidate of CANDIDATE_ORDER) {
    const runs = readRuns(out, candidate);
    const scores: IDeckScore[] = [];
    for (const deck of decks) {
      const run = runs.find((r) => r.deck === deck.deck);
      if (!run) continue;
      let yes = 0;
      for (const card of run.status === 'ok' ? (run.top10 ?? []) : []) {
        const verdict = verdicts.get(`${deck.deck}\u0000${card}`) ?? 'invalid';
        if (verdict === 'invalid') invalid += 1;
        if (verdict === 'yes') yes += 1;
      }
      scores.push({ deck, run, yes });
    }
    byCandidate.set(candidate, scores);
  }
  if (invalid > 0) return { ok: false, invalid };

  const tried = (candidate: TCandidateName): boolean =>
    decks.length > 0 && (byCandidate.get(candidate)?.length ?? 0) === decks.length;
  const passes = (candidate: TCandidateName): number =>
    (byCandidate.get(candidate) ?? []).filter((s) => s.run.status === 'ok' && s.yes >= PASS_THRESHOLD).length;

  const lines: string[] = ['# Synergy spike result', '', '| candidate | deck | hero | yes in top 10 | result |', '| --- | --- | --- | --- | --- |'];
  for (const candidate of CANDIDATE_ORDER) {
    for (const { deck, run, yes } of byCandidate.get(candidate) ?? []) {
      const cells = run.status === 'ok'
        ? [String(yes), yes >= PASS_THRESHOLD ? 'PASS' : 'FAIL']
        : [describeStatus(run), '-'];
      lines.push(`| ${candidate} | ${deck.deck} | ${heroName(deck)} | ${cells[0]} | ${cells[1]} |`);
    }
  }

  const llmUsage = (byCandidate.get('llm') ?? []).flatMap((s) => (s.run.usage ? [s.run.usage] : []));
  if ((byCandidate.get('llm') ?? []).length > 0) {
    const input = llmUsage.reduce((sum, u) => sum + u.inputTokens, 0);
    const output = llmUsage.reduce((sum, u) => sum + u.outputTokens, 0);
    lines.push('', `llm tokens used: ${input} input, ${output} output`);
  }

  const winner = CANDIDATE_ORDER.find((c) => passes(c) >= REQUIRED_DECK_COUNT);
  const next = CANDIDATE_ORDER.find((c) => !tried(c));
  lines.push('');
  if (winner) lines.push(`STOP: ${winner} passed on ${REQUIRED_DECK_COUNT} decks`);
  else if (next === undefined) lines.push('STOP: all candidates tried once, none passed');
  else lines.push(`CONTINUE: next candidate is ${next}`);

  return { ok: true, markdown: `${lines.join('\n')}\n` };
}

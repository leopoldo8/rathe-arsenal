import type { ICatalog } from '../../../packages/engine/src';
import { rankHeuristic } from '../candidates/heuristic';
import { runCooccurrence } from '../candidates/cooccurrence';
import { finalizeTop10 } from './finalize';
import { readDecks, readPool, runPath, writeJson } from './io';
import type { IDeckFile, IPoolFile, IRunFile, TCandidateName } from './types';

export interface IRunOptions {
  readonly candidate: TCandidateName;
  readonly out: string;
  readonly catalog: ICatalog;
  readonly onlyDeck?: string | undefined;
}

/** Turns a candidate's ranked identifiers into the deck's run: ok with 10, or failed. */
export function toRunFile(
  deck: IDeckFile,
  pool: IPoolFile,
  candidate: TCandidateName,
  ranked: readonly string[],
  extra: Partial<IRunFile> = {},
): IRunFile {
  const top10 = finalizeTop10({
    ranked,
    pool: new Set(pool.cards),
    inDeck: new Set(deck.mainboard.map((e) => e.card)),
  });
  if (top10 === null) {
    return {
      deck: deck.deck,
      candidate,
      status: 'failed',
      error: 'fewer than 10 valid cards remained after dropping identifiers outside the pool or in the deck',
      ...extra,
    };
  }
  return { deck: deck.deck, candidate, status: 'ok', top10, ...extra };
}

export function exitCodeFor(runs: readonly IRunFile[]): number {
  return runs.some((r) => r.status === 'failed') ? 1 : 0;
}

export function selectDecks(out: string, onlyDeck?: string): IDeckFile[] {
  const decks = readDecks(out);
  return onlyDeck === undefined ? decks : decks.filter((d) => d.deck === onlyDeck.toUpperCase());
}

async function runDeck(deck: IDeckFile, opts: IRunOptions): Promise<IRunFile> {
  if (opts.candidate === 'cooccurrence') return runCooccurrence(deck.deck, deck.hero);
  const pool = readPool(opts.out, deck.deck);
  if (opts.candidate === 'heuristic') {
    return toRunFile(deck, pool, 'heuristic', rankHeuristic(deck, pool, opts.catalog));
  }
  throw new Error(`candidate "${opts.candidate}" is not runnable here`);
}

export async function runCandidate(opts: IRunOptions): Promise<{ runs: IRunFile[]; exitCode: number }> {
  const runs: IRunFile[] = [];
  for (const deck of selectDecks(opts.out, opts.onlyDeck)) {
    const run = await runDeck(deck, opts);
    writeJson(runPath(opts.out, opts.candidate, deck.deck), run);
    runs.push(run);
  }
  return { runs, exitCode: exitCodeFor(runs) };
}

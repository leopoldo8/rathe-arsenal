import { finalizeTop10 } from './finalize';
import type { IDeckFile, IPoolFile, IRunFile, TCandidateName } from './types';

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

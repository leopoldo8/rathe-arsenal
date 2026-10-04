import { TOP_N } from './types';

export interface IFinalizeInput {
  readonly ranked: readonly string[];
  readonly pool: ReadonlySet<string>;
  readonly inDeck: ReadonlySet<string>;
}

/**
 * Keeps the first TOP_N distinct identifiers that are in the pool and not in
 * the deck, in rank order. Returns null when fewer remain, so the caller records
 * the deck's run as failed instead of padding the list.
 */
export function finalizeTop10(input: IFinalizeInput): readonly string[] | null {
  const kept: string[] = [];
  for (const id of input.ranked) {
    if (!input.pool.has(id) || input.inDeck.has(id) || kept.includes(id)) continue;
    kept.push(id);
    if (kept.length === TOP_N) return kept;
  }
  return null;
}

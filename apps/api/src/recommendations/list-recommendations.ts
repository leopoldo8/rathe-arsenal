import { TRecommendationStrength } from '../database/entities/recommendation.entity';

const STRENGTH_ORDER: Readonly<Record<TRecommendationStrength, number>> = { clear_upgrade: 0, consider: 1 };

/** What the panel lists from a run: no dismissed card, no card already in the deck, clear upgrades first, then rank. */
export function listRecommendations<T extends { readonly cardIdentifier: string; readonly strength: TRecommendationStrength; readonly rank: number }>(
  rows: readonly T[],
  dismissed: ReadonlySet<string>,
  inDeck: ReadonlySet<string>,
): T[] {
  return rows
    .filter((row) => !dismissed.has(row.cardIdentifier) && !inDeck.has(row.cardIdentifier))
    .sort((a, b) => STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] || a.rank - b.rank);
}

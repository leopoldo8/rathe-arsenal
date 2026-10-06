/** Cards the deck's latest run recommends come first, by run rank; the rest keep their order. */
export function orderByRecommendations<T extends { readonly cardIdentifier: string }>(
  cards: readonly T[],
  recommendedRanks: ReadonlyMap<string, number>,
): T[] {
  const recommended = cards
    .filter((card) => recommendedRanks.has(card.cardIdentifier))
    .sort((a, b) => recommendedRanks.get(a.cardIdentifier)! - recommendedRanks.get(b.cardIdentifier)!);
  return [...recommended, ...cards.filter((card) => !recommendedRanks.has(card.cardIdentifier))];
}

/**
 * Builds the `currentDeckSlots` set `reconcileSwapSuggestions` needs to
 * decide whether an unmatched persisted row's position has actually left
 * the deck. Every caller must use this helper rather than hand-rolling the
 * `${cardIdentifier}::${slot}` format -- it has to match
 * `reconcile-swap-suggestions.ts`'s own internal `deckSlotKey` exactly, or
 * every row would look orphaned.
 */
export function buildCurrentDeckSlots(
  deckCards: readonly { readonly cardIdentifier: string; readonly slot: string }[],
): ReadonlySet<string> {
  return new Set(deckCards.map((card) => `${card.cardIdentifier}::${card.slot}`));
}

/**
 * Key for one (card, slot) position in the protected-copies input of
 * `computeEffectiveReadiness`. Callers build the map with this helper so the
 * key format stays in one place, as `buildExclusionKey` does for swaps.
 */
export function buildProtectedKey(cardIdentifier: string, slot: string): string {
  return `${cardIdentifier}::${slot}`;
}

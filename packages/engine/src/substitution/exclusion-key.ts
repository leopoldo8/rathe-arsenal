/**
 * Branded key identifying one (original card, slot, substitute card) triple
 * within a single deck's exclusion/approval sets.
 *
 * `slot` is part of the key -- not just the (original, substitute) pair --
 * because a deck can hold the same original card in two different slots
 * (no schema constraint prevents it), each with its own independent
 * substitution decision. Keying on the pair alone would let a decision made
 * against one slot silently apply to the other slot's untouched suggestion.
 *
 * Branding (rather than a plain `string`) makes every un-migrated call site
 * that still builds a bare `Set<string>` a compile error instead of a
 * silent no-op suppression.
 */
export type TExclusionKey = string & { readonly __brand: 'ExclusionKey' };

export function buildExclusionKey(
  originalCardIdentifier: string,
  slot: string,
  substituteCardIdentifier: string,
): TExclusionKey {
  return `${originalCardIdentifier}::${slot}::${substituteCardIdentifier}` as TExclusionKey;
}

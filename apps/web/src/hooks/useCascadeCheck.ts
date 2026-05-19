/**
 * useCascadeCheck — client-side per-card legality check for Edit mode.
 *
 * Pure hook (no server calls, no engine import). Reads the `legalFormats`,
 * `legalHeroes`, and `bannedFormats` fields that the /catalog/search endpoint
 * returns (U17 extension) to determine which cards in the draft are not
 * compatible with the draft's current hero + format.
 *
 * IMPORTANT: This hook intentionally does NOT import `@rathe-arsenal/engine`
 * or `@flesh-and-blood/cards`. The engine is ~9MB and must not be bundled
 * into the web app. The authoritative legality check runs server-side in U6
 * after Save. This hook is for client-side UX feedback only.
 *
 * Returns:
 *  - `illegalCardIds`: Set of cardIdentifiers that appear to violate the
 *    current format/hero combination.
 *  - `count`: size of the set (convenience accessor).
 */
import { useMemo } from 'react';
import type { ICompositionDraft } from './useCompositionDraft';

export interface ICascadeCheckResult {
  readonly illegalCardIds: ReadonlySet<string>;
  readonly count: number;
}

/**
 * Per-card cascade legality check.
 *
 * A card is considered potentially illegal when ANY of these is true:
 *  1. `legalFormats` is non-empty AND the draft format is not in it.
 *  2. `bannedFormats` includes the draft format.
 *  3. `legalHeroes` is non-empty AND the draft heroIdentifier is not in it.
 *
 * When `legalFormats` is empty (not yet populated by the API) the card
 * is treated as potentially legal (conservative fallback — avoid false flags).
 *
 * When `legalHeroes` is empty the card has no hero restriction (all heroes).
 */
function isCardIllegal(
  card: ICompositionDraft['cards'][number],
  format: string,
  heroIdentifier: string | null,
): boolean {
  // Check: card is explicitly banned in this format
  if ((card.bannedFormats ?? []).includes(format)) return true;

  // Check: card is format-restricted and current format not in legal list
  if (card.legalFormats.length > 0 && !card.legalFormats.includes(format)) return true;

  // Check: card is hero-restricted and current hero not in legal list
  if (
    card.legalHeroes.length > 0 &&
    heroIdentifier !== null &&
    !card.legalHeroes.includes(heroIdentifier)
  ) {
    return true;
  }

  return false;
}

export function useCascadeCheck(draft: ICompositionDraft): ICascadeCheckResult {
  return useMemo<ICascadeCheckResult>(() => {
    const illegal = new Set<string>();
    for (const card of draft.cards) {
      if (isCardIllegal(card, draft.format, draft.heroIdentifier)) {
        illegal.add(card.cardIdentifier);
      }
    }
    return { illegalCardIds: illegal, count: illegal.size };
  }, [draft]);
}

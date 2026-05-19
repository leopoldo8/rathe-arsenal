/**
 * Non-component helpers and constants for the home route.
 *
 * Extracted so that `home.tsx` stays component-only and Fast Refresh
 * works without warnings. The leading `-` makes TanStack Router ignore
 * this file as a route.
 *
 * Mirrors the shape of `-library.helpers.ts` → `validateLibrarySearch`.
 *
 * Consumers:
 *  - `home.tsx` (route component)
 */

// ---------------------------------------------------------------------------
// Search param types
// ---------------------------------------------------------------------------

export interface THomeSearch {
  /**
   * Active tag filter chips. OR logic across the set — a deck with ANY
   * matching tag passes. Empty array = no filter (all decks shown).
   * TanStack Router serialises this as a JSON-encoded array in the URL:
   *   ?tag=%5B%22foo%22%2C%22bar%22%5D
   */
  readonly tag: readonly string[];
}

// ---------------------------------------------------------------------------
// Default search
// ---------------------------------------------------------------------------

export const DEFAULT_HOME_SEARCH: THomeSearch = {
  tag: [],
};

// ---------------------------------------------------------------------------
// validateHomeSearch
// ---------------------------------------------------------------------------

/**
 * Validates and sanitises raw URL search params for the home route.
 *
 * `tag`: accepts a JSON-array value (TanStack Router's default serialiser for
 * arrays). Strings only — any non-string elements are filtered out silently.
 * Non-array `tag` (e.g. a single string from a hand-crafted URL) falls back to
 * empty so the page renders all decks rather than crashing.
 *
 * Unknown tag names are NOT filtered here; callers are responsible for
 * cross-referencing against the user-owned tags list (the truth source).
 */
export function validateHomeSearch(raw: Record<string, unknown>): THomeSearch {
  const tag = Array.isArray(raw.tag)
    ? raw.tag.filter((t): t is string => typeof t === 'string')
    : [];

  return { tag };
}

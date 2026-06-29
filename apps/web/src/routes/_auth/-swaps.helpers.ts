/**
 * Pure helper functions for the Swaps page.
 *
 * Extracted into a sibling file so that `swaps.tsx` remains a component-only
 * module and Fast Refresh works without warnings.
 */

import type { IReviewRow } from '../../api/reviews';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ISwapsSearch {
  readonly state: 'pending' | 'approved' | 'rejected' | 'all';
  readonly tier: ReadonlyArray<1 | 2 | 3>;
  readonly deck: readonly string[];
  readonly hero: readonly string[];
  readonly confidenceMin: number;
  readonly confidenceMax: number;
}

export interface IReviewRowGroup {
  readonly row: IReviewRow;
  readonly count: number;
}

// ---------------------------------------------------------------------------
// Grouping helper
// ---------------------------------------------------------------------------

/**
 * Groups identical Swaps rows (same trackedDeckId + cardIdentifier + substituteIdentifier)
 * into a single `IReviewRowGroup`. Preserves first-seen order; `row` is the first
 * occurrence; `count` is the number of rows merged.
 */
export function groupReviewRows(rows: readonly IReviewRow[]): readonly IReviewRowGroup[] {
  const map = new Map<string, IReviewRowGroup>();
  for (const row of rows) {
    const key = `${row.trackedDeckId}:${row.cardIdentifier}:${row.substituteIdentifier}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, { row: existing.row, count: existing.count + 1 });
    } else {
      map.set(key, { row, count: 1 });
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

/**
 * Filters `allRows` according to the active tab state and attribute filters.
 */
export function applyFilters(
  rows: readonly IReviewRow[],
  search: ISwapsSearch,
): readonly IReviewRow[] {
  return rows.filter((row) => {
    // Tab filter (state)
    if (search.state !== 'all' && row.decision !== search.state) return false;

    // Tier filter
    if (search.tier.length > 0 && !search.tier.includes(row.tier)) return false;

    // Deck filter (uses trackedDeckId as string)
    if (
      search.deck.length > 0 &&
      !search.deck.includes(String(row.trackedDeckId))
    )
      return false;

    // Hero filter
    if (search.hero.length > 0 && !search.hero.includes(row.hero)) return false;

    // Confidence range
    if (row.confidence < search.confidenceMin || row.confidence > search.confidenceMax)
      return false;

    return true;
  });
}

/**
 * Derives per-state counts for the tab badges from the full row set.
 * The "All" count is the total regardless of state.
 */
export function computeTabCounts(rows: readonly IReviewRow[]): {
  pending: number;
  approved: number;
  rejected: number;
  all: number;
} {
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  for (const row of rows) {
    if (row.decision === 'pending') pending++;
    else if (row.decision === 'approved') approved++;
    else if (row.decision === 'rejected') rejected++;
  }

  return { pending, approved, rejected, all: rows.length };
}

/**
 * Derives a deduplicated list of {id, name} deck options from the row set.
 * Uses trackedDeckId as the id value (stringified for the filter URL param).
 */
export function deriveUniqueDecks(
  rows: readonly IReviewRow[],
): ReadonlyArray<{ readonly id: string; readonly name: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const id = String(row.trackedDeckId);
    if (!seen.has(id)) {
      seen.set(id, row.deckName);
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

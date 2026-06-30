/**
 * Pure helper functions for the BreakdownSections component.
 *
 * Extracted into a sibling file so that `BreakdownSections.tsx` remains a
 * component-only module and Fast Refresh works without warnings.
 *
 * Mirrors the `-swaps.helpers.ts` sibling-helper pattern.
 */

import type { ISubstitutedEntry } from '../../api/deck-detail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ISubstitutedGroup {
  /** Representative (first occurrence) entry for this group. */
  readonly entry: ISubstitutedEntry;
  /** Number of identical entries merged into this group (>= 1). */
  readonly count: number;
}

// ---------------------------------------------------------------------------
// Grouping helper
// ---------------------------------------------------------------------------

/**
 * Groups identical deck-detail substituted entries (same original.cardIdentifier,
 * same original.slot, same match.substitute.cardIdentifier) into a single
 * `ISubstitutedGroup`. Preserves first-seen order; `entry` is the first
 * occurrence; `count` is the number of entries merged.
 *
 * SWAPGRP-02: renders one row per group in the deck-detail breakdown.
 * SWAPGRP-04: different substitute → separate group.
 * SWAPGRP-06: key includes original + slot + substitute (no key collision).
 */
export function groupSubstitutedEntries(
  entries: readonly ISubstitutedEntry[],
): readonly ISubstitutedGroup[] {
  const map = new Map<string, ISubstitutedGroup>();
  for (const entry of entries) {
    const key = `${entry.original.cardIdentifier}:${entry.original.slot}:${entry.match.substitute.cardIdentifier}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, { entry: existing.entry, count: existing.count + 1 });
    } else {
      map.set(key, { entry, count: 1 });
    }
  }
  return Array.from(map.values());
}

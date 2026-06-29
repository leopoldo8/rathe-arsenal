/**
 * Unit tests for groupSubstitutedEntries (SWAPGRP-02, SWAPGRP-04, SWAPGRP-06)
 *
 * Test scenarios derived from spec.md acceptance criteria and T4 "Done when":
 *  - 2 identical entries (same original + same substitute) → 1 group, count 2
 *  - Same original/slot + different substitute → 2 separate groups
 *  - Single entry → 1 group, count 1
 *  - First-seen order is preserved
 */

import { describe, it, expect } from 'vitest';
import { groupSubstitutedEntries, type ISubstitutedGroup } from '../BreakdownSections.helpers';
import type { ISubstitutedEntry } from '../../../api/deck-detail';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeEntry = (
  originalId: string,
  slot: string,
  substituteId: string,
): ISubstitutedEntry => ({
  original: {
    cardIdentifier: originalId,
    name: originalId,
    quantity: 1,
    slot,
    pitch: 1 as const,
    cost: 2,
    type: 'attack',
    imageUrl: null,
  },
  match: {
    substitute: {
      cardIdentifier: substituteId,
      name: substituteId,
      classes: [],
      pitch: 1,
      power: null,
      defense: null,
      keywords: [],
      imageUrl: null,
    },
    tier: 1,
    score: 0.9,
    rationale: 'Test rationale',
  },
});

// Two entries that are identical (same original + same substitute in same slot)
const ENTRY_A1 = makeEntry('pummel', 'action', 'open-the-floodgates');
const ENTRY_A2 = makeEntry('pummel', 'action', 'open-the-floodgates');

// Same original/slot but different substitute
const ENTRY_B = makeEntry('pummel', 'action', 'razor-reflex');

// Different original
const ENTRY_C = makeEntry('scar-for-a-scar', 'action', 'open-the-floodgates');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('groupSubstitutedEntries', () => {
  it('returns an empty array when given empty input', () => {
    // Arrange
    const entries: readonly ISubstitutedEntry[] = [];

    // Act
    const groups = groupSubstitutedEntries(entries);

    // Assert
    expect(groups).toHaveLength(0);
  });

  it('returns one group with count 1 for a single entry (SWAPGRP-05, SWAPGRP-06)', () => {
    // Arrange — single non-duplicated entry
    const entries = [ENTRY_A1];

    // Act
    const groups = groupSubstitutedEntries(entries);

    // Assert — grouping is a no-op for non-duplicates
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(1);
    expect(groups[0]!.entry).toBe(ENTRY_A1);
  });

  it('merges 2 identical entries into 1 group with count 2 (SWAPGRP-02, SWAPGRP-03)', () => {
    // Arrange — two entries sharing same originalId + slot + substituteId
    const entries = [ENTRY_A1, ENTRY_A2];

    // Act
    const groups = groupSubstitutedEntries(entries);

    // Assert — exactly 1 group, count is 2
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(2);
    // entry is the first occurrence (representative)
    expect(groups[0]!.entry).toBe(ENTRY_A1);
  });

  it('keeps same-original/same-slot + different-substitute as separate groups (SWAPGRP-04)', () => {
    // Arrange — ENTRY_A1 and ENTRY_B share original+slot but have different substitutes
    const entries = [ENTRY_A1, ENTRY_B];

    // Act
    const groups = groupSubstitutedEntries(entries);

    // Assert — 2 groups, counts are each 1
    expect(groups).toHaveLength(2);
    expect(groups[0]!.count).toBe(1);
    expect(groups[1]!.count).toBe(1);
    const subIds = groups.map((g: ISubstitutedGroup) => g.entry.match.substitute.cardIdentifier);
    expect(subIds).toContain('open-the-floodgates');
    expect(subIds).toContain('razor-reflex');
  });

  it('preserves first-seen order across different groups (SWAPGRP-06)', () => {
    // Arrange — entries in order: B, A1, A2, C
    // Expected group order (first-seen): B first, then A, then C
    const entries = [ENTRY_B, ENTRY_A1, ENTRY_A2, ENTRY_C];

    // Act
    const groups = groupSubstitutedEntries(entries);

    // Assert — 3 groups in first-seen order
    expect(groups).toHaveLength(3);
    expect(groups[0]!.entry).toBe(ENTRY_B);
    expect(groups[1]!.entry).toBe(ENTRY_A1);
    expect(groups[1]!.count).toBe(2);
    expect(groups[2]!.entry).toBe(ENTRY_C);
  });

  it('uses group key that includes slot — same card in different slots are separate groups', () => {
    // Arrange — same original and substitute but different slot
    const entryMainboard = makeEntry('pummel', 'mainboard', 'open-the-floodgates');
    const entryEquipment = makeEntry('pummel', 'equipment', 'open-the-floodgates');
    const entries = [entryMainboard, entryEquipment];

    // Act
    const groups = groupSubstitutedEntries(entries);

    // Assert — 2 separate groups (different slot = different group key)
    expect(groups).toHaveLength(2);
    expect(groups[0]!.entry.original.slot).toBe('mainboard');
    expect(groups[1]!.entry.original.slot).toBe('equipment');
  });
});

/**
 * Unit tests for groupReviewRows — spec ACs SWAPGRP-01, 04, 05, 06
 *
 * Covers:
 *  - 2 identical rows (same deck + original + substitute) → 1 group, count=2
 *  - Same original + different substitute → 2 separate groups (SWAPGRP-04)
 *  - Single non-duplicated entry → 1 group, count=1 (SWAPGRP-05)
 *  - First-seen order is preserved
 *  - Same substitute for two different originals → 2 groups (not merged across originals)
 *  - Empty input → empty output
 */

import { describe, it, expect } from 'vitest';
import type { IReviewRow } from '../../../api/reviews';
import { groupReviewRows } from '../-swaps.helpers';

// ---- Fixture ----

function makeRow(overrides: Partial<IReviewRow> = {}): IReviewRow {
  return {
    trackedDeckId: 1,
    deckName: 'Test Deck',
    hero: 'Briar',
    cardIdentifier: 'ARC001',
    originalName: 'ARC001',
    substituteIdentifier: 'ELE001',
    substituteName: 'Sub Card',
    tier: 1,
    confidence: 80,
    rationale: 'Good fit.',
    decision: 'pending',
    originalImageUrl: null,
    substituteImageUrl: null,
    originalPitch: 1,
    substitutePitch: 1,
    originalType: 'action',
    substituteType: 'action',
    ...overrides,
  };
}

// ---- Tests ----

describe('groupReviewRows — identical copies merge (SWAPGRP-01, 06)', () => {
  it('2 rows with identical deck+original+substitute → 1 group with count=2', () => {
    const rows = [
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
    ];
    const groups = groupReviewRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(2);
  });

  it('merged group uses the first occurrence as the representative row', () => {
    const first = makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001', rationale: 'First' });
    const second = makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001', rationale: 'Second' });
    const groups = groupReviewRows([first, second]);
    expect(groups[0]?.row.rationale).toBe('First');
  });
});

describe('groupReviewRows — same original, different substitute → separate groups (SWAPGRP-04)', () => {
  it('same original + 2 different substitutes → 2 groups, each with count=1', () => {
    const rows = [
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE002' }),
    ];
    const groups = groupReviewRows(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.count).toBe(1);
    expect(groups[1]?.count).toBe(1);
  });

  it('combined fixture: 2 identical + 1 same-original/different-substitute → 2 groups with counts {2, 1}', () => {
    // Canonical spec fixture from spec.md "Independent Test"
    const rows = [
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE002' }),
    ];
    const groups = groupReviewRows(rows);
    expect(groups).toHaveLength(2);
    const counts = groups.map((g) => g.count).sort((a, b) => b - a);
    expect(counts).toEqual([2, 1]);
  });
});

describe('groupReviewRows — single entry → count=1 (SWAPGRP-05)', () => {
  it('single non-duplicated entry → 1 group of count 1', () => {
    const rows = [makeRow()];
    const groups = groupReviewRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(1);
  });

  it('single entry group row is the original row', () => {
    const row = makeRow({ cardIdentifier: 'ARC999', substituteIdentifier: 'ELE999' });
    const groups = groupReviewRows([row]);
    expect(groups[0]?.row).toBe(row);
  });
});

describe('groupReviewRows — first-seen order preserved', () => {
  it('groups appear in first-seen order of the first occurrence', () => {
    const rows = [
      makeRow({ trackedDeckId: 1, cardIdentifier: 'BETA', substituteIdentifier: 'S1' }),
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ALPHA', substituteIdentifier: 'S2' }),
      makeRow({ trackedDeckId: 1, cardIdentifier: 'BETA', substituteIdentifier: 'S1' }), // duplicate
    ];
    const groups = groupReviewRows(rows);
    // BETA group seen first, then ALPHA
    expect(groups[0]?.row.cardIdentifier).toBe('BETA');
    expect(groups[1]?.row.cardIdentifier).toBe('ALPHA');
  });
});

describe('groupReviewRows — same substitute, different originals → separate groups', () => {
  it('same substitute for two different originals → 2 groups (not merged)', () => {
    const rows = [
      makeRow({ cardIdentifier: 'ORIG1', substituteIdentifier: 'COMMON-SUB' }),
      makeRow({ cardIdentifier: 'ORIG2', substituteIdentifier: 'COMMON-SUB' }),
    ];
    const groups = groupReviewRows(rows);
    expect(groups).toHaveLength(2);
  });
});

describe('groupReviewRows — different decks same original+substitute → separate groups', () => {
  it('same original+substitute across different decks → 2 separate groups', () => {
    const rows = [
      makeRow({ trackedDeckId: 1, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
      makeRow({ trackedDeckId: 2, cardIdentifier: 'ARC001', substituteIdentifier: 'ELE001' }),
    ];
    const groups = groupReviewRows(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.count).toBe(1);
    expect(groups[1]?.count).toBe(1);
  });
});

describe('groupReviewRows — empty input', () => {
  it('empty rows → empty groups', () => {
    const groups = groupReviewRows([]);
    expect(groups).toHaveLength(0);
  });
});

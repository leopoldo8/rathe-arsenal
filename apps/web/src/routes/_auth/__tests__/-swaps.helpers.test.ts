import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  computeTabCounts,
  deriveUniqueDecks,
  resolveConfidenceBand,
} from '../-swaps.helpers';
import type { ISwapsSearch } from '../-swaps.helpers';
import { makeSwapRow } from '../../../test/swap-fixtures';

const ALL: ISwapsSearch = {
  state: 'all',
  tier: [],
  deck: [],
  hero: [],
  confidenceMin: 0,
  confidenceMax: 100,
};

describe('computeTabCounts', () => {
  it('derives every count from the rows and never counts retired rows', () => {
    const rows = [
      makeSwapRow({ status: 'pending' }),
      makeSwapRow({ status: 'pending' }),
      makeSwapRow({ status: 'approved' }),
      makeSwapRow({ status: 'rejected' }),
      makeSwapRow({ status: 'retired' }),
    ];

    expect(computeTabCounts(rows)).toEqual({ pending: 2, approved: 1, rejected: 1, all: 4 });
  });

  it('is all zeros for no rows', () => {
    expect(computeTabCounts([])).toEqual({ pending: 0, approved: 0, rejected: 0, all: 0 });
  });

  it('counts a x N group once, because the API already returns one row per group', () => {
    const rows = [makeSwapRow({ quantity: 3 })];

    expect(computeTabCounts(rows).pending).toBe(1);
  });
});

describe('applyFilters', () => {
  const pendingTier1 = makeSwapRow({ status: 'pending', tier: 1, confidence: 95, trackedDeckId: 1, hero: 'Dromai' });
  const approvedTier2 = makeSwapRow({ status: 'approved', tier: 2, confidence: 72, trackedDeckId: 2, hero: 'Briar' });
  const retired = makeSwapRow({ status: 'retired' });
  const rows = [pendingTier1, approvedTier2, retired];

  it('filters by tab state', () => {
    expect(applyFilters(rows, { ...ALL, state: 'approved' })).toEqual([approvedTier2]);
  });

  it('shows every state but retired on the all tab', () => {
    expect(applyFilters(rows, ALL)).toEqual([pendingTier1, approvedTier2]);
  });

  it('filters by tier', () => {
    expect(applyFilters(rows, { ...ALL, tier: [2] })).toEqual([approvedTier2]);
  });

  it('filters by deck id', () => {
    expect(applyFilters(rows, { ...ALL, deck: ['1'] })).toEqual([pendingTier1]);
  });

  it('filters by hero', () => {
    expect(applyFilters(rows, { ...ALL, hero: ['Briar'] })).toEqual([approvedTier2]);
  });

  it('keeps both ends of the confidence range', () => {
    expect(applyFilters(rows, { ...ALL, confidenceMin: 72, confidenceMax: 95 })).toEqual([
      pendingTier1,
      approvedTier2,
    ]);
    expect(applyFilters(rows, { ...ALL, confidenceMin: 73, confidenceMax: 94 })).toEqual([]);
  });

  it('combines filters with AND', () => {
    expect(applyFilters(rows, { ...ALL, state: 'pending', tier: [2] })).toEqual([]);
  });
});

describe('deriveUniqueDecks', () => {
  it('lists each deck once and ignores retired rows', () => {
    const rows = [
      makeSwapRow({ trackedDeckId: 1, deckName: 'A' }),
      makeSwapRow({ trackedDeckId: 1, deckName: 'A' }),
      makeSwapRow({ trackedDeckId: 2, deckName: 'B', status: 'retired' }),
    ];

    expect(deriveUniqueDecks(rows)).toEqual([{ id: '1', name: 'A' }]);
  });
});

describe('resolveConfidenceBand', () => {
  it.each([
    [100, 'high'],
    [90, 'high'],
    [89, 'mid'],
    [70, 'mid'],
    [69, 'low'],
    [0, 'low'],
  ])('%i is the %s band', (confidence, band) => {
    expect(resolveConfidenceBand(confidence)).toBe(band);
  });
});

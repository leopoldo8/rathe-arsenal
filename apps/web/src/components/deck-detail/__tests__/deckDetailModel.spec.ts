import { describe, it, expect } from 'vitest';
import { resolveScoreBand, summariseDeck } from '../deckDetailModel';
import { breakdown, decision, entry, swap } from './deckDetailTestData';

describe('summariseDeck — kind', () => {
  it('is complete at exactly 100', () => {
    const result = summariseDeck({ pct: 100, path: 'A', breakdown: breakdown(), decisions: [] });
    expect(result.kind).toBe('complete');
  });

  it('is not complete just under 100', () => {
    const result = summariseDeck({ pct: 99.9, path: 'C', breakdown: breakdown(), decisions: [] });
    expect(result.kind).not.toBe('complete');
  });

  it('is solvable on Path B below 100 with a pending swap', () => {
    const result = summariseDeck({
      pct: 78,
      path: 'B',
      breakdown: breakdown({ substituted: [swap({ cardIdentifier: 'a' }, 'sub-a')] }),
      decisions: [],
    });
    expect(result.kind).toBe('solvable');
    expect(result.pendingSwaps).toBe(1);
  });

  it('is incomplete on Path B below 100 when no swap is pending', () => {
    const result = summariseDeck({ pct: 78, path: 'B', breakdown: breakdown(), decisions: [] });
    expect(result.kind).toBe('incomplete');
  });

  it('is incomplete on Path C even with pending swaps', () => {
    const result = summariseDeck({
      pct: 40,
      path: 'C',
      breakdown: breakdown({
        substituted: [swap({ cardIdentifier: 'a' }, 'sub-a')],
        missing: [entry({ cardIdentifier: 'b' })],
      }),
      decisions: [],
    });
    expect(result.kind).toBe('incomplete');
  });
});

describe('summariseDeck — counts', () => {
  const data = breakdown({
    substituted: [
      swap({ cardIdentifier: 'a', quantity: 2 }, 'sub-a'),
      swap({ cardIdentifier: 'b', quantity: 1 }, 'sub-b'),
    ],
    missing: [entry({ cardIdentifier: 'c', quantity: 3 })],
  });

  it('counts cards and slots across open gaps while every swap is pending', () => {
    const result = summariseDeck({ pct: 30, path: 'C', breakdown: data, decisions: [] });
    expect(result.missingCards).toBe(6);
    expect(result.missingSlots).toBe(3);
    expect(result.pendingSwaps).toBe(2);
    expect(result.approvedSwaps).toBe(0);
  });

  it('reports only the gap with no swap as unsolved', () => {
    const result = summariseDeck({ pct: 30, path: 'C', breakdown: data, decisions: [] });
    expect(result.unsolvedCards).toBe(3);
  });

  it('drops a gap covered by an approved swap from the open list', () => {
    const result = summariseDeck({
      pct: 50,
      path: 'C',
      breakdown: data,
      decisions: [decision('sub-a', 'approved')],
    });
    expect(result.approvedSwaps).toBe(1);
    expect(result.pendingSwaps).toBe(1);
    expect(result.missingCards).toBe(4);
    expect(result.openMissing.map((e) => e.cardIdentifier)).toEqual(['c', 'b']);
  });

  it('treats a rejected swap as an unsolved gap, not a pending or applied one', () => {
    const result = summariseDeck({
      pct: 30,
      path: 'C',
      breakdown: data,
      decisions: [decision('sub-b', 'rejected')],
    });
    expect(result.pendingSwaps).toBe(1);
    expect(result.approvedSwaps).toBe(0);
    expect(result.unsolvedCards).toBe(4);
  });

  it('keys gaps by card and slot, so the same card in two slots stays two gaps', () => {
    const result = summariseDeck({
      pct: 30,
      path: 'C',
      breakdown: breakdown({
        missing: [
          entry({ cardIdentifier: 'x', slot: 'mainboard' }),
          entry({ cardIdentifier: 'x', slot: 'equipment' }),
        ],
      }),
      decisions: [],
    });
    expect(result.missingSlots).toBe(2);
  });
});

describe('resolveScoreBand — rounded percent boundaries', () => {
  it.each([
    [90, 'high'],
    [89, 'mid'],
    [70, 'mid'],
    [69, 'low'],
    [100, 'high'],
    [0, 'low'],
  ])('%i%% is %s', (percent, band) => {
    expect(resolveScoreBand(percent)).toBe(band);
  });
});

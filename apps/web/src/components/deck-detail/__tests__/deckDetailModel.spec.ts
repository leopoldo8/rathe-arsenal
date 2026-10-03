import { describe, it, expect } from 'vitest';
import { resolveScoreBand, summariseDeck } from '../deckDetailModel';
import { breakdown, deckSwap, entry, swap } from './deckDetailTestData';

describe('summariseDeck — kind', () => {
  it('is complete at exactly 100', () => {
    const result = summariseDeck({ pct: 100, path: 'A', breakdown: breakdown(), swaps: [] });
    expect(result.kind).toBe('complete');
  });

  it('is not complete just under 100', () => {
    const result = summariseDeck({ pct: 99.9, path: 'C', breakdown: breakdown(), swaps: [] });
    expect(result.kind).not.toBe('complete');
  });

  it('is solvable on Path B below 100 with a pending swap', () => {
    const result = summariseDeck({
      pct: 78,
      path: 'B',
      breakdown: breakdown({ substituted: [swap({ cardIdentifier: 'a' }, 'sub-a')] }),
      swaps: [],
    });
    expect(result.kind).toBe('solvable');
    expect(result.pendingSwaps).toBe(1);
  });

  it('is incomplete on Path B below 100 when no swap is pending', () => {
    const result = summariseDeck({ pct: 78, path: 'B', breakdown: breakdown(), swaps: [] });
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
      swaps: [],
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
    const result = summariseDeck({ pct: 30, path: 'C', breakdown: data, swaps: [] });
    expect(result.missingCards).toBe(6);
    expect(result.missingSlots).toBe(3);
    expect(result.pendingSwaps).toBe(2);
    expect(result.approvedSwaps).toBe(0);
  });

  it('reports only the gap with no swap as unsolved', () => {
    const result = summariseDeck({ pct: 30, path: 'C', breakdown: data, swaps: [] });
    expect(result.unsolvedCards).toBe(3);
  });

  it('drops a gap covered by an approved swap from the open list', () => {
    const result = summariseDeck({
      pct: 50,
      path: 'C',
      breakdown: data,
      swaps: [deckSwap('a', 'sub-a', 'approved')],
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
      swaps: [deckSwap('b', 'sub-b', 'rejected')],
    });
    expect(result.pendingSwaps).toBe(1);
    expect(result.approvedSwaps).toBe(0);
    expect(result.unsolvedCards).toBe(4);
  });

  it('decides each slot on its own when two slots share one substitute', () => {
    const twoSlots = breakdown({
      substituted: [
        swap({ cardIdentifier: 'x', slot: 'mainboard' }, 'sub-x'),
        swap({ cardIdentifier: 'x', slot: 'equipment' }, 'sub-x'),
      ],
    });
    const result = summariseDeck({
      pct: 50,
      path: 'B',
      breakdown: twoSlots,
      swaps: [deckSwap('x', 'sub-x', 'approved', 'equipment')],
    });
    expect(result.approvedSwaps).toBe(1);
    expect(result.pendingSwaps).toBe(1);
  });

  it('treats a swap the list does not know yet as pending', () => {
    const result = summariseDeck({
      pct: 30,
      path: 'C',
      breakdown: data,
      swaps: [deckSwap('other', 'sub-other', 'approved')],
    });
    expect(result.pendingSwaps).toBe(2);
    expect(result.approvedSwaps).toBe(0);
  });

  it('reads an applied swap from the engine flag until the swaps list has loaded', () => {
    const flagged = breakdown({
      substituted: [{ ...swap({ cardIdentifier: 'a' }, 'sub-a'), approved: true }],
    });

    const result = summariseDeck({ pct: 100, path: 'B', breakdown: flagged, swaps: [] });

    expect(result.approvedSwaps).toBe(1);
    expect(result.pendingSwaps).toBe(0);
  });

  it('lets the swaps list win over the engine flag once it knows the swap', () => {
    const flagged = breakdown({
      substituted: [{ ...swap({ cardIdentifier: 'a' }, 'sub-a'), approved: true }],
    });

    const result = summariseDeck({
      pct: 60,
      path: 'B',
      breakdown: flagged,
      swaps: [deckSwap('a', 'sub-a', 'pending')],
    });

    expect(result.approvedSwaps).toBe(0);
    expect(result.pendingSwaps).toBe(1);
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
      swaps: [],
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

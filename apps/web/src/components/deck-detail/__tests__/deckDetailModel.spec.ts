import { describe, it, expect } from 'vitest';
import type { IDeckReplacement } from '../../../api/replacements';
import { findSuggestions, resolveScoreBand, summariseDeck } from '../deckDetailModel';
import { breakdown, entry, swap } from './deckDetailTestData';

function heldBy(cardIdentifier: string, quantity: number): IDeckReplacement {
  return {
    id: `r-${cardIdentifier}`,
    slot: 'mainboard',
    originalCardIdentifier: 'original',
    originalName: 'Original',
    originalPitch: null,
    replacementCardIdentifier: cardIdentifier,
    quantity,
    originalOwned: false,
  };
}

describe('findSuggestions', () => {
  it("a missing row's suggestion is the first stand-in found for its card and slot", () => {
    const data = breakdown({
      substituted: [
        swap({ cardIdentifier: 'a' }, 'stand-in-a1'),
        swap({ cardIdentifier: 'a' }, 'stand-in-b2'),
        swap({ cardIdentifier: 'x', slot: 'mainboard' }, 'stand-in-x-main'),
        swap({ cardIdentifier: 'x', slot: 'equipment' }, 'stand-in-x-equipment'),
        swap({ cardIdentifier: 'held', quantity: 2 }, 'stand-in-held'),
      ],
      missing: [entry({ cardIdentifier: 'none' })],
      notOwned: [
        entry({ cardIdentifier: 'a', quantity: 2 }),
        entry({ cardIdentifier: 'none' }),
        entry({ cardIdentifier: 'x', slot: 'mainboard' }),
        entry({ cardIdentifier: 'x', slot: 'equipment' }),
        entry({ cardIdentifier: 'held', quantity: 2 }),
      ],
    });

    const suggestions = findSuggestions(data, [heldBy('held', 2)]);
    const picked = Object.fromEntries(
      [...suggestions].map(([key, value]) => [key, value.match.substitute.cardIdentifier]),
    );

    expect(picked).toEqual({
      'a::mainboard': 'stand-in-a1',
      'x::mainboard': 'stand-in-x-main',
      'x::equipment': 'stand-in-x-equipment',
    });
    const summary = summariseDeck({
      pct: 40,
      breakdown: breakdown({
        substituted: [swap({ cardIdentifier: 'a' }, 'stand-in-a1'), swap({ cardIdentifier: 'b' }, 'stand-in-b')],
        missing: [entry({ cardIdentifier: 'none' })],
      }),
      replacements: [],
    });
    expect(summary.suggestionCount).toBe(2);
  });
});

describe('summariseDeck', () => {
  it('is complete at exactly 100 and not just under it', () => {
    expect(summariseDeck({ pct: 100, breakdown: breakdown(), replacements: [] }).kind).toBe('complete');
    expect(summariseDeck({ pct: 99.9, breakdown: breakdown(), replacements: [] }).kind).not.toBe('complete');
  });

  it('offers suggestions when a missing row has one, and is incomplete otherwise', () => {
    const withSuggestion = summariseDeck({
      pct: 40,
      breakdown: breakdown({ substituted: [swap({ cardIdentifier: 'a' }, 'sub-a')], missing: [entry({ cardIdentifier: 'b' })] }),
      replacements: [],
    });
    const without = summariseDeck({
      pct: 40,
      breakdown: breakdown({ missing: [entry({ cardIdentifier: 'b', quantity: 3 })] }),
      replacements: [],
    });

    expect(withSuggestion.kind).toBe('suggestions');
    expect(without.kind).toBe('incomplete');
    expect(without.missingCards).toBe(3);
  });

  it('counts every copy the collection does not cover exactly, suggestions included', () => {
    const result = summariseDeck({
      pct: 30,
      breakdown: breakdown({
        substituted: [swap({ cardIdentifier: 'a', quantity: 2 }, 'sub-a'), swap({ cardIdentifier: 'b' }, 'sub-b')],
        missing: [entry({ cardIdentifier: 'c', quantity: 3 })],
      }),
      replacements: [],
    });

    expect(result.missingCards).toBe(6);
    expect(result.openMissing).toHaveLength(3);
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

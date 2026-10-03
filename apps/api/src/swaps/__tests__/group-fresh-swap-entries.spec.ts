import { ISubstitutedEntry } from '@rathe-arsenal/engine';
import { groupFreshSwapEntries } from '../group-fresh-swap-entries';

function makeEntry(overrides: {
  cardIdentifier: string;
  slot: string;
  substituteIdentifier: string;
  tier?: 1 | 2;
  score?: number;
  approved?: boolean;
}): ISubstitutedEntry {
  return {
    original: {
      cardIdentifier: overrides.cardIdentifier,
      name: overrides.cardIdentifier,
      quantity: 1,
      slot: overrides.slot,
      pitch: 1,
      cost: 1,
      type: 'Action',
      imageUrl: null,
    },
    match: {
      substitute: {
        cardIdentifier: overrides.substituteIdentifier,
        name: overrides.substituteIdentifier,
      } as ISubstitutedEntry['match']['substitute'],
      tier: overrides.tier ?? 1,
      score: overrides.score ?? 1,
      rationale: 'Same class, same pitch',
    },
    approved: overrides.approved ?? false,
  };
}

describe('groupFreshSwapEntries', () => {
  it('returns an empty array for no entries', () => {
    expect(groupFreshSwapEntries([])).toEqual([]);
  });

  it('collapses two per-copy entries sharing a quadruple key into one group with quantity 2', () => {
    const entries = [
      makeEntry({ cardIdentifier: 'original', slot: 'mainboard', substituteIdentifier: 'sub' }),
      makeEntry({ cardIdentifier: 'original', slot: 'mainboard', substituteIdentifier: 'sub' }),
    ];

    const groups = groupFreshSwapEntries(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      cardIdentifier: 'original',
      slot: 'mainboard',
      substituteIdentifier: 'sub',
      quantity: 2,
    });
  });

  it('keeps two copies with different substitutes as two separate groups (inventory-exhaustion case)', () => {
    const entries = [
      makeEntry({ cardIdentifier: 'original', slot: 'mainboard', substituteIdentifier: 'sub-a' }),
      makeEntry({ cardIdentifier: 'original', slot: 'mainboard', substituteIdentifier: 'sub-b' }),
    ];

    const groups = groupFreshSwapEntries(entries);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.substituteIdentifier).sort()).toEqual(['sub-a', 'sub-b']);
    expect(groups.every((g) => g.quantity === 1)).toBe(true);
  });

  it('keeps the same original+substitute pair in two different slots as two separate groups', () => {
    const entries = [
      makeEntry({ cardIdentifier: 'original', slot: 'slot-a', substituteIdentifier: 'sub' }),
      makeEntry({ cardIdentifier: 'original', slot: 'slot-b', substituteIdentifier: 'sub' }),
    ];

    const groups = groupFreshSwapEntries(entries);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.slot).sort()).toEqual(['slot-a', 'slot-b']);
  });

  it('is independent of the approved flag -- pending and approved copies of the same key still collapse together', () => {
    const entries = [
      makeEntry({ cardIdentifier: 'original', slot: 'mainboard', substituteIdentifier: 'sub', approved: false }),
      makeEntry({ cardIdentifier: 'original', slot: 'mainboard', substituteIdentifier: 'sub', approved: true }),
    ];

    const groups = groupFreshSwapEntries(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.quantity).toBe(2);
  });

  it('normalizes a 0-1 engine score into a 0-100 confidence integer', () => {
    const groups = groupFreshSwapEntries([
      makeEntry({ cardIdentifier: 'a', slot: 'mainboard', substituteIdentifier: 'b', score: 0.875 }),
    ]);

    expect(groups[0]!.confidence).toBe(88);
  });

  it('passes through a score already in the 0-100 range', () => {
    const groups = groupFreshSwapEntries([
      makeEntry({ cardIdentifier: 'a', slot: 'mainboard', substituteIdentifier: 'b', score: 92 }),
    ]);

    expect(groups[0]!.confidence).toBe(92);
  });
});

import {
  IFreshSwapGroup,
  IPersistedSwapRow,
  reconcileSwapSuggestions,
} from '../reconcile-swap-suggestions';

function makeGroup(overrides: Partial<IFreshSwapGroup> = {}): IFreshSwapGroup {
  return {
    cardIdentifier: 'original-card',
    slot: 'mainboard',
    substituteIdentifier: 'substitute-card',
    quantity: 1,
    tier: 1,
    confidence: 90,
    rationale: 'Same class, same pitch',
    ...overrides,
  };
}

function makeRow(overrides: Partial<IPersistedSwapRow> = {}): IPersistedSwapRow {
  return {
    id: 'row-1',
    cardIdentifier: 'original-card',
    slot: 'mainboard',
    substituteIdentifier: 'substitute-card',
    status: 'pending',
    ...overrides,
  };
}

describe('reconcileSwapSuggestions', () => {
  it('produces no mutations when there are no persisted rows and no fresh groups', () => {
    const mutations = reconcileSwapSuggestions([], [], new Set());
    expect(mutations).toEqual([]);
  });

  it('inserts a new row for a fresh group with no persisted match', () => {
    const group = makeGroup();
    const mutations = reconcileSwapSuggestions([], [group], new Set(['original-card::mainboard']));

    expect(mutations).toEqual([{ kind: 'insert', group }]);
  });

  it('updates a pending row in place when the fresh group still matches', () => {
    const row = makeRow({ status: 'pending' });
    const group = makeGroup({ confidence: 92 });

    const mutations = reconcileSwapSuggestions(
      [row],
      [group],
      new Set(['original-card::mainboard']),
    );

    expect(mutations).toEqual([{ kind: 'update', id: row.id, group, unretire: false }]);
  });

  it('un-retires a retired row when the same quadruple reappears', () => {
    const row = makeRow({ status: 'retired' });
    const group = makeGroup();

    const mutations = reconcileSwapSuggestions(
      [row],
      [group],
      new Set(['original-card::mainboard']),
    );

    expect(mutations).toEqual([{ kind: 'update', id: row.id, group, unretire: true }]);
  });

  it('refreshes display fields on an approved row but never touches its status', () => {
    const row = makeRow({ status: 'approved' });
    const group = makeGroup({ confidence: 95 });

    const mutations = reconcileSwapSuggestions(
      [row],
      [group],
      new Set(['original-card::mainboard']),
    );

    expect(mutations).toEqual([{ kind: 'update', id: row.id, group, unretire: false }]);
  });

  it('leaves a rejected row untouched even if a fresh group somehow matches its key', () => {
    const row = makeRow({ status: 'rejected' });
    const group = makeGroup();

    const mutations = reconcileSwapSuggestions(
      [row],
      [group],
      new Set(['original-card::mainboard']),
    );

    expect(mutations).toEqual([]);
  });

  it('retires a pending row whose (cardIdentifier, slot) has left the deck', () => {
    const row = makeRow({ status: 'pending' });

    const mutations = reconcileSwapSuggestions([row], [], new Set());

    expect(mutations).toEqual([{ kind: 'retire', id: row.id }]);
  });

  it('retires an approved row whose (cardIdentifier, slot) has left the deck (orphaned approval)', () => {
    const row = makeRow({ status: 'approved' });

    const mutations = reconcileSwapSuggestions([row], [], new Set());

    expect(mutations).toEqual([{ kind: 'retire', id: row.id }]);
  });

  it('leaves a rejected row untouched when its slot has left the deck', () => {
    const row = makeRow({ status: 'rejected' });

    const mutations = reconcileSwapSuggestions([row], [], new Set());

    expect(mutations).toEqual([]);
  });

  it('leaves an already-retired row untouched when it still has no match', () => {
    const row = makeRow({ status: 'retired' });

    const mutations = reconcileSwapSuggestions([row], [], new Set());

    expect(mutations).toEqual([]);
  });

  describe('the two cases that must be visibly distinguished (owned-count-zero vs. slot-removed)', () => {
    it('(a) unmatched row whose (cardIdentifier, slot) is absent from currentDeckSlots -> retire', () => {
      const row = makeRow({ status: 'pending' });

      const mutations = reconcileSwapSuggestions([row], [], new Set(['other-card::mainboard']));

      expect(mutations).toEqual([{ kind: 'retire', id: row.id }]);
    });

    it('(b) unmatched row whose (cardIdentifier, slot) is still present in currentDeckSlots -> no mutation', () => {
      // The position still exists; the substitute simply has zero owned
      // copies this recompute (findTierMatch skips owned<=0 candidates).
      // An implementation that retires on every unmatched row would still
      // pass every other case in this suite -- this is the one that catches it.
      const row = makeRow({ status: 'pending' });

      const mutations = reconcileSwapSuggestions(
        [row],
        [],
        new Set(['original-card::mainboard']),
      );

      expect(mutations).toEqual([]);
    });
  });

  it('handles many persisted rows against one fresh group correctly', () => {
    const matching = makeRow({ id: 'row-match', status: 'pending' });
    const orphanedInDeck = makeRow({
      id: 'row-orphan-in-deck',
      cardIdentifier: 'other-card',
      slot: 'mainboard',
      status: 'pending',
    });
    const orphanedOutOfDeck = makeRow({
      id: 'row-orphan-out',
      cardIdentifier: 'gone-card',
      slot: 'mainboard',
      status: 'approved',
    });
    const rejected = makeRow({ id: 'row-rejected', cardIdentifier: 'rej-card', status: 'rejected' });

    const group = makeGroup();

    const mutations = reconcileSwapSuggestions(
      [matching, orphanedInDeck, orphanedOutOfDeck, rejected],
      [group],
      new Set(['original-card::mainboard', 'other-card::mainboard']),
    );

    expect(mutations).toEqual(
      expect.arrayContaining([
        { kind: 'update', id: 'row-match', group, unretire: false },
        { kind: 'retire', id: 'row-orphan-out' },
      ]),
    );
    expect(mutations).toHaveLength(2);
  });

  it('a slot-scoped quadruple key keeps two suggestions for the same original card in different slots independent', () => {
    const rowSlotA = makeRow({ id: 'row-a', slot: 'slot-a', status: 'approved' });
    const rowSlotB = makeRow({ id: 'row-b', slot: 'slot-b', status: 'pending' });
    const freshSlotA = makeGroup({ slot: 'slot-a', confidence: 99 });

    // Slot B's group vanished this recompute (e.g. exhausted substitute)
    // but its position is still in the deck.
    const mutations = reconcileSwapSuggestions(
      [rowSlotA, rowSlotB],
      [freshSlotA],
      new Set(['original-card::slot-a', 'original-card::slot-b']),
    );

    expect(mutations).toEqual([
      { kind: 'update', id: 'row-a', group: freshSlotA, unretire: false },
    ]);
  });
});

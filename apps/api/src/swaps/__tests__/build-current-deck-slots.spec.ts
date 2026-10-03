import { buildCurrentDeckSlots } from '../build-current-deck-slots';

describe('buildCurrentDeckSlots', () => {
  it('builds one key per (cardIdentifier, slot) pair', () => {
    const slots = buildCurrentDeckSlots([
      { cardIdentifier: 'a', slot: 'mainboard' },
      { cardIdentifier: 'b', slot: 'hero' },
    ]);

    expect(slots).toEqual(new Set(['a::mainboard', 'b::hero']));
  });

  it('returns an empty set for an empty deck', () => {
    expect(buildCurrentDeckSlots([])).toEqual(new Set());
  });

  it('keeps the same card in two different slots as two distinct keys', () => {
    const slots = buildCurrentDeckSlots([
      { cardIdentifier: 'a', slot: 'slot-1' },
      { cardIdentifier: 'a', slot: 'slot-2' },
    ]);

    expect(slots).toEqual(new Set(['a::slot-1', 'a::slot-2']));
  });
});

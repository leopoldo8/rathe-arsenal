import { describeDeck } from '../deck-facts';

const KATSU_ROWS = [
  { cardIdentifier: 'katsu-the-wanderer', quantity: 1, slot: 'hero' },
  { cardIdentifier: 'talishar-the-lost-prince', quantity: 1, slot: 'weapon' },
  { cardIdentifier: 'flex-red', quantity: 3, slot: 'mainboard' },
  { cardIdentifier: 'whelming-gustwave-yellow', quantity: 2, slot: 'mainboard' },
  { cardIdentifier: 'nimblism-blue', quantity: 3, slot: 'mainboard' },
  { cardIdentifier: 'consuming-volition-red', quantity: 1, slot: 'mainboard' },
];

describe('deck facts', () => {
  it('counts slots, pitch, cost, card types, defense, attacks, equipment, resources and the card pool, and flags cards the hero cannot play', () => {
    const facts = describeDeck({ heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed', rows: KATSU_ROWS });

    expect(facts['totals']).toEqual({
      bySlot: { hero: 1, weapon: 1, mainboard: 9 },
      mainboardByPitch: { red: 4, yellow: 2, blue: 3, noPitch: 0 },
      mainboardByCost: { '0': 8, '1': 1 },
      mainboardByType: { 'Action Attack': 6, 'Action Non-Attack': 3 },
      cardPool: 10,
      illegalCards: ['consuming-volition-red'],
      mainboardByDefense: { '2': 6, '3': 3 },
      defenseReactions: 0,
      attacks: { cards: 6, withGoAgain: 2, averagePower: 3.3 },
      equipment: { slots: [], missingSlots: ['Head', 'Chest', 'Arms', 'Legs'], defense: 0 },
      resources: {
        averagePitch: 1.9,
        averageCost: 0.1,
        abilityCosts: [{ cardIdentifier: 'talishar-the-lost-prince', name: 'Talishar, the Lost Prince', kind: 'activation', resources: 2 }],
      },
    });
    expect(facts['formatRules']).toEqual({ minMainboard: 60, exactMainboard: null, maxCardPool: 80, maxCopies: 3 });
  });

  it('gives every card its name, type, pitch, cost, power, defense and text', () => {
    const facts = describeDeck({ heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed', rows: KATSU_ROWS });
    const flex = (facts['cards'] as Array<Record<string, unknown>>).find((card) => card['cardIdentifier'] === 'flex-red');

    expect(flex).toEqual(
      expect.objectContaining({
        name: 'Flex',
        slot: 'mainboard',
        quantity: 3,
        pitch: 1,
        cost: 0,
        power: 4,
        defense: 2,
        typeLine: 'Generic Action Attack',
        legal: true,
        text: expect.any(String),
      }),
    );
    expect((flex!['text'] as string).length).toBeGreaterThan(0);
  });

  it('places tournament cards by type when the list has no slots', () => {
    const facts = describeDeck({
      heroIdentifier: 'katsu-the-wanderer',
      format: 'Blitz',
      rows: [
        { cardIdentifier: 'talishar-the-lost-prince', quantity: 1 },
        { cardIdentifier: 'flex-red', quantity: 2 },
      ],
    });

    expect((facts['totals'] as { bySlot: unknown }).bySlot).toEqual({ weapon: 1, mainboard: 2 });
    expect(facts['formatRules']).toEqual(expect.objectContaining({ exactMainboard: 40, maxCopies: 1 }));
  });
});

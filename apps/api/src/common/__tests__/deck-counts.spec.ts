import { catalog } from '@rathe-arsenal/engine';
import { countByCost, countByDefense, countByPitch, countByType, rangeAcross } from '../deck-counts';

const counted = (rows: ReadonlyArray<[string, number]>) => rows.map(([cardIdentifier, quantity]) => ({ card: catalog.getCard(cardIdentifier), quantity }));

describe('deck counts', () => {
  const cards = counted([
    ['flex-red', 3],
    ['whelming-gustwave-yellow', 2],
    ['nimblism-blue', 3],
    ['consuming-volition-red', 1],
  ]);

  it('counts copies by pitch, cost, card type and defense', () => {
    expect(countByPitch(cards)).toEqual({ red: 4, yellow: 2, blue: 3, noPitch: 0 });
    expect(countByCost(cards)).toEqual({ '0': 8, '1': 1 });
    expect(countByType(cards)).toEqual({ 'Action Attack': 6, 'Action Non-Attack': 3 });
    expect(countByDefense(cards)).toEqual({ '2': 6, '3': 3 });
  });

  it('orders costs cheapest first, with cards without a cost last', () => {
    expect(Object.keys(countByCost(counted([['consuming-volition-red', 1], ['boltn-boots', 1], ['flex-red', 1]])))).toEqual(['0', '1', 'noCost']);
  });

  it('gives the average, lowest and highest of each key across decks, a missing key counting as 0', () => {
    expect(rangeAcross([{ arrows: 22, buffs: 16 }, { arrows: 18, buffs: 20, attacks: 2 }, { arrows: 20, buffs: 20 }])).toEqual({
      arrows: { average: 20, min: 18, max: 22 },
      buffs: { average: 18.7, min: 16, max: 20 },
      attacks: { average: 0.7, min: 0, max: 2 },
    });
  });
});

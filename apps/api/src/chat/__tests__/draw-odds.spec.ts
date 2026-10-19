import { catalog } from '@rathe-arsenal/engine';
import { chanceOfAtLeast, drawOdds } from '../draw-odds';

describe('chanceOfAtLeast', () => {
  it('gives the hypergeometric chance of drawing at least so many of the matching cards', () => {
    expect(chanceOfAtLeast({ deckSize: 40, matching: 4, drawn: 4, atLeast: 1 })).toBeCloseTo(0.3555, 4);
    expect(chanceOfAtLeast({ deckSize: 40, matching: 2, drawn: 4, atLeast: 1 })).toBeCloseTo(0.1923, 4);
    expect(chanceOfAtLeast({ deckSize: 40, matching: 22, drawn: 4, atLeast: 2 })).toBeCloseTo(0.7701, 4);
    expect(chanceOfAtLeast({ deckSize: 40, matching: 2, drawn: 8, atLeast: 1 })).toBeCloseTo(0.3641, 4);
  });

  it('is 0 with no matching card or more wanted than drawn, and 1 when nothing is needed', () => {
    expect(chanceOfAtLeast({ deckSize: 40, matching: 0, drawn: 4, atLeast: 1 })).toBe(0);
    expect(chanceOfAtLeast({ deckSize: 40, matching: 10, drawn: 4, atLeast: 5 })).toBe(0);
    expect(chanceOfAtLeast({ deckSize: 40, matching: 10, drawn: 4, atLeast: 0 })).toBe(1);
  });
});

describe('drawOdds', () => {
  const AZALEA_MAINBOARD = [
    { cardIdentifier: 'azalea', quantity: 1, slot: 'hero' },
    { cardIdentifier: 'infecting-shot-blue', quantity: 2, slot: 'mainboard' },
    { cardIdentifier: 'infecting-shot-red', quantity: 2, slot: 'mainboard' },
    { cardIdentifier: 'lace-with-bloodrot-red', quantity: 2, slot: 'mainboard' },
    { cardIdentifier: 'flex-red', quantity: 34, slot: 'mainboard' },
  ];

  it("opens with the hero's intellect and counts the mainboard copies that match every filter given", () => {
    expect(drawOdds({ hero: catalog.getCard('azalea'), rows: AZALEA_MAINBOARD, filter: { pitch: 3 }, atLeast: 1, extraDraws: 0 })).toEqual({
      heroIntellect: 4,
      deckSize: 40,
      matchingCopies: 2,
      cardsSeen: 4,
      atLeast: 1,
      chance: 0.192,
    });
    expect(drawOdds({ hero: catalog.getCard('azalea'), rows: AZALEA_MAINBOARD, filter: { cardType: 'arrow', pitch: 1 }, atLeast: 1, extraDraws: 4 })).toEqual(
      expect.objectContaining({ matchingCopies: 2, cardsSeen: 8, chance: 0.364 }),
    );
    expect(
      drawOdds({ hero: catalog.getCard('azalea'), rows: AZALEA_MAINBOARD, filter: { cardIdentifiers: ['lace-with-bloodrot-red', 'infecting-shot-red'] }, atLeast: 1, extraDraws: 0 }),
    ).toEqual(expect.objectContaining({ matchingCopies: 4, chance: 0.355 }));
  });
});

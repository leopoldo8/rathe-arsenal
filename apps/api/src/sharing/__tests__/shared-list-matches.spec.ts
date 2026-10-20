import { buildListMatches } from '../shared-list-matches';

const LINES = [
  { id: 1, cardIdentifier: 'pummel-red', sold: false },
  { id: 2, cardIdentifier: 'pummel-red', sold: false },
  { id: 3, cardIdentifier: 'sink-below-red', sold: true },
  { id: 4, cardIdentifier: 'nothing-owned', sold: false },
];
const OWNED = new Map([
  ['pummel-red', 2],
  ['sink-below-red', 1],
]);
const MISSING = new Map([
  ['pummel-red', 3],
  ['sink-below-red', 4],
]);

describe('buildListMatches', () => {
  it('reports the visitor quantity per line on a want list and never a deck gap', () => {
    expect(buildListMatches('want', LINES, OWNED, MISSING)).toEqual([
      { lineId: 1, owned: 2, missingInDecks: 0 },
      { lineId: 2, owned: 2, missingInDecks: 0 },
      { lineId: 3, owned: 1, missingInDecks: 0 },
      { lineId: 4, owned: 0, missingInDecks: 0 },
    ]);
  });

  it('adds the deck gap to available sell lines, card by card', () => {
    const matches = buildListMatches('sell', LINES, OWNED, MISSING);

    expect(matches.map((match) => match.missingInDecks)).toEqual([3, 3, 0, 0]);
  });

  it('gives a sold sell line no deck gap but keeps what the visitor owns', () => {
    const [, , sold] = buildListMatches('sell', LINES, OWNED, MISSING);

    expect(sold).toEqual({ lineId: 3, owned: 1, missingInDecks: 0 });
  });

  it('answers an empty list with no lines', () => {
    expect(buildListMatches('sell', [], OWNED, MISSING)).toEqual([]);
  });
});

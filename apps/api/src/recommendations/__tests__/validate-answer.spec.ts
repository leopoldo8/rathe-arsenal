import { catalog } from '@rathe-arsenal/engine';
import { IGeminiEntry } from '../gemini-client';
import { IDeckListCard } from '../recommendation-prompt';
import { selectRecommendations } from '../validate-answer';

const deckCards: IDeckListCard[] = [
  { cardIdentifier: 'emissary-of-tides-red', slot: 'mainboard', quantity: 2 },
  { cardIdentifier: 'flex-red', slot: 'mainboard', quantity: 2 },
  { cardIdentifier: 'talishar-the-lost-prince', slot: 'weapon', quantity: 1 },
];

const POOL_CARDS = [
  'ancestral-harmony-blue',
  'art-of-the-dragon-blood-red',
  'art-of-the-dragon-claw-red',
  'adrenaline-rush-red',
  'adrenaline-rush-yellow',
  'adrenaline-rush-blue',
  'amethyst-amulet-blue',
  'deathmatch-arena',
  'authority-of-ataya-blue',
  'arcane-lantern',
  'arcanite-fortress',
] as const;
const pool = new Set<string>(POOL_CARDS);

function entry(card: string, overrides: Partial<IGeminiEntry> = {}): IGeminiEntry {
  return { card, strength: 'consider', cut: '', reason: `reason for ${card}`, ...overrides };
}

describe('selectRecommendations', () => {
  it('keeps the first 10 valid entries in order', () => {
    const entries = [
      entry(POOL_CARDS[0], { strength: 'clear_upgrade' }),
      entry('not-in-pool-1'),
      entry(POOL_CARDS[1]),
      entry(POOL_CARDS[0]),
      entry(POOL_CARDS[2], { strength: 'great' }),
      entry(POOL_CARDS[3]),
      entry('emissary-of-tides-red'),
      entry(POOL_CARDS[4]),
      entry(POOL_CARDS[5]),
      entry(POOL_CARDS[6]),
      entry(POOL_CARDS[7]),
      entry(POOL_CARDS[8]),
      entry(POOL_CARDS[9]),
      entry(POOL_CARDS[10]),
      entry(POOL_CARDS[2]),
    ];

    const { kept, dropped } = selectRecommendations(entries, pool, deckCards, catalog);

    expect(kept.map((row) => [row.rank, row.cardIdentifier])).toEqual([
      [1, POOL_CARDS[0]],
      [2, POOL_CARDS[1]],
      [3, POOL_CARDS[3]],
      [4, POOL_CARDS[4]],
      [5, POOL_CARDS[5]],
      [6, POOL_CARDS[6]],
      [7, POOL_CARDS[7]],
      [8, POOL_CARDS[8]],
      [9, POOL_CARDS[9]],
      [10, POOL_CARDS[10]],
    ]);
    expect(kept[0]!.strength).toBe('clear_upgrade');
    expect(kept[0]!.reason).toBe(`reason for ${POOL_CARDS[0]}`);
    expect(dropped).toBe(4);
  });

  it("keeps a cut only from the recommended card's slot", () => {
    const entries = [
      entry('adrenaline-rush-red', { cut: 'flex-red' }),
      entry('adrenaline-rush-yellow', { cut: 'talishar-the-lost-prince' }),
      entry('adrenaline-rush-blue', { cut: 'ancestral-harmony-blue' }),
      entry('ancestral-harmony-blue', { cut: '' }),
      entry('arcane-lantern', { cut: 'flex-red' }),
    ];

    const { kept } = selectRecommendations(entries, pool, deckCards, catalog);

    expect(kept.map((row) => [row.cardIdentifier, row.cutCardIdentifier, row.cutSlot])).toEqual([
      ['adrenaline-rush-red', 'flex-red', 'mainboard'],
      ['adrenaline-rush-yellow', null, null],
      ['adrenaline-rush-blue', null, null],
      ['ancestral-harmony-blue', null, null],
      ['arcane-lantern', null, null],
    ]);
  });

  it('an answer with nothing valid keeps nothing', () => {
    const { kept, dropped } = selectRecommendations(
      [entry('not-a-card'), entry('flex-red'), entry('adrenaline-rush-red', { strength: '' })],
      pool,
      deckCards,
      catalog,
    );

    expect(kept).toEqual([]);
    expect(dropped).toBe(3);
  });
});

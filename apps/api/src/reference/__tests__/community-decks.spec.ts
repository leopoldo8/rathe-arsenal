import { catalog, computeDeckLegality, findCardLegalityViolation } from '@rathe-arsenal/engine';
import { slotOf } from '../../chat/proposal-validation';
import { ICommunityDeckImport } from '../../fabrary/dtos/deck-import.dto';
import { COMMUNITY_DECKS_FETCHED, ICommunityDeckSource, loadCommunityDecks } from '../community-decks';
import { IIndexDeck, IIndexRequest, IIndexResult } from '../fabrary-index';

const HERO = 'azalea';
const FORMAT = 'Silver Age';
const NOW = new Date('2026-10-18T12:00:00Z');

const heroCard = catalog.getCard(HERO);
const LEGAL_MAINBOARD = catalog.cards
  .filter((card) => slotOf(card) === 'mainboard' && findCardLegalityViolation(card, heroCard, FORMAT) === null)
  .slice(0, 21)
  .map((card) => card.cardIdentifier);

function legalDeck(ulid: string, firstCard = 0, extra: Partial<ICommunityDeckImport> = {}): ICommunityDeckImport {
  const mainboard = LEGAL_MAINBOARD.slice(firstCard, firstCard + 20).map((cardIdentifier) => ({ cardIdentifier, quantity: 2, slot: 'mainboard' as const }));
  return { ulid, name: ulid, format: FORMAT, hero: { cardIdentifier: HERO, name: 'Azalea' }, mainboard, equipment: [], weapons: [], inventory: [], matchupPlans: 0, ...extra };
}

const JYREM_MAINBOARD = [
  'boltn-shot-red',
  'call-in-the-big-guns-red',
  'drill-shot-red',
  'dry-powder-shot-red',
  'infecting-shot-blue',
  'infecting-shot-red',
  'infecting-shot-yellow',
  'lace-with-frailty-red',
  'lace-with-inertia-red',
  'murkmire-grapnel-red',
  'ravenous-rabble-red',
  'read-the-glide-path-red',
  'release-the-tension-red',
  'ridge-rider-shot-red',
  'scout-the-periphery-red',
  'searing-shot-red',
  'spire-sniping-yellow',
  'swift-shot-red',
  'take-aim-red',
];

function azaleaDeck(ulid: string, twentiethCard: string): ICommunityDeckImport {
  const mainboard = [...JYREM_MAINBOARD, twentiethCard].map((cardIdentifier) => ({ cardIdentifier, quantity: 2, slot: 'mainboard' as const }));
  return { ...legalDeck(ulid), mainboard };
}

function hit(deckId: string, updatedAt: string, overrides: Partial<IIndexDeck> = {}): IIndexDeck {
  return { deckId, name: `Deck ${deckId}`, format: FORMAT, heroIdentifier: HERO, updatedAt, hasResults: false, ...overrides };
}

function sourceOf(hits: readonly IIndexDeck[], decks: Record<string, ICommunityDeckImport | Error>): ICommunityDeckSource & { requests: IIndexRequest[]; fetched: string[] } {
  const requests: IIndexRequest[] = [];
  const fetched: string[] = [];
  return {
    requests,
    fetched,
    query: async (request): Promise<IIndexResult> => {
      requests.push(request);
      return { nbHits: hits.length, hits };
    },
    fetchDeck: async (ulid) => {
      fetched.push(ulid);
      const deck = decks[ulid];
      if (deck === undefined || deck instanceof Error) throw deck ?? new Error('missing');
      return deck;
    },
  };
}

describe('loadCommunityDecks', () => {
  it('the test deck is legal for young Azalea in Silver Age', () => {
    const deck = legalDeck('x');

    expect(computeDeckLegality({ heroIdentifier: HERO, cards: deck.mainboard }, catalog, FORMAT).category).toBe('legal');
  });

  it('asks the index only for public non-tournament, non-precon decks of that exact hero and format', async () => {
    const source = sourceOf([], {});

    await loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    expect(source.requests).toHaveLength(1);
    expect(source.requests[0]!.filters).toBe('NOT isTournament:true AND NOT isPrecon:true AND format:"Silver Age" AND heroIdentifier:"azalea"');
  });

  it('fetches at most the newest decks of the last 12 months, decks with results, matchup plans or notes first, and keeps only complete legal ones of that hero', async () => {
    const hits = [
      hit('old', '2025-09-01T00:00:00Z'),
      hit('other-hero', '2026-10-15T00:00:00Z', { heroIdentifier: 'azalea-ace-in-the-hole' }),
      ...Array.from({ length: 10 }, (_, index) => hit(`new-${index}`, `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00Z`)),
      hit('played', '2026-03-01T00:00:00Z', { hasResults: true }),
    ];
    const decks: Record<string, ICommunityDeckImport | Error> = {
      played: legalDeck('played'),
      'new-9': legalDeck('new-9', 1),
      'new-8': { ...legalDeck('new-8'), mainboard: legalDeck('new-8').mainboard.slice(0, 10) },
      'new-7': { ...legalDeck('new-7'), hero: { cardIdentifier: 'azalea-ace-in-the-hole', name: 'Azalea' } },
      'new-6': new Error('Fabrary down for this one'),
      'new-5': legalDeck('new-5'),
    };
    const source = sourceOf(hits, decks);

    const result = await loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    expect(source.fetched).toHaveLength(COMMUNITY_DECKS_FETCHED);
    expect(source.fetched[0]).toBe('played');
    expect(source.fetched).not.toContain('old');
    expect(source.fetched).not.toContain('other-hero');
    expect(result.inspected).toBe(COMMUNITY_DECKS_FETCHED);
    expect(result.decks.map((deck) => deck.url)).toEqual([
      'https://fabrary.net/decks/played',
      'https://fabrary.net/decks/new-9',
      'https://fabrary.net/decks/new-5',
    ]);
    expect(result.decks[0]).toEqual({
      name: 'Deck played',
      updatedAt: '2026-03-01',
      hasResults: true,
      matchupPlans: 0,
      inventoryCards: 0,
      url: 'https://fabrary.net/decks/played',
      mainboardByType: expect.any(Object),
      mainboardByPitch: expect.any(Object),
      mainboardByCost: expect.any(Object),
    });
  });

  it('lists the most complete decks first: recorded results, then more matchup sideboard plans, then more inventory cards, then the newest', async () => {
    const inventory = [{ cardIdentifier: LEGAL_MAINBOARD[20]!, quantity: 2, slot: 'mainboard' as const }];
    const hits = [
      hit('newest', '2026-10-12T00:00:00Z'),
      hit('inventory', '2026-10-01T00:00:00Z'),
      hit('plans', '2026-09-01T00:00:00Z', { hasMatchups: true }),
      hit('results', '2026-08-01T00:00:00Z', { hasResults: true }),
    ];
    const source = sourceOf(hits, {
      newest: legalDeck('newest'),
      inventory: legalDeck('inventory', 0, { inventory }),
      plans: legalDeck('plans', 0, { matchupPlans: 4 }),
      results: legalDeck('results'),
    });

    const result = await loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    expect(result.decks.map((deck) => [deck.name, deck.matchupPlans, deck.inventoryCards])).toEqual([
      ['Deck results', 0, 0],
      ['Deck plans', 4, 0],
      ['Deck inventory', 0, 2],
      ['Deck newest', 0, 0],
    ]);
  });

  it('sums each card across the kept decks: in how many decks and the average copies, most played first', async () => {
    const shared = LEGAL_MAINBOARD[1]!;
    const onlyFirst = LEGAL_MAINBOARD[0]!;
    const onlySecond = LEGAL_MAINBOARD[20]!;
    const source = sourceOf([hit('a', '2026-10-10T00:00:00Z'), hit('b', '2026-10-09T00:00:00Z')], { a: legalDeck('a', 0), b: legalDeck('b', 1) });

    const result = await loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    const byCard = new Map(result.cards.map((card) => [card.cardIdentifier, card]));
    expect(byCard.get(shared)).toEqual(expect.objectContaining({ decks: 2, averageCopies: 2, slot: 'mainboard', pitch: catalog.getCard(shared).pitch ?? null }));
    expect(byCard.get(onlyFirst)).toEqual(expect.objectContaining({ decks: 1, averageCopies: 2 }));
    expect(byCard.get(onlySecond)).toEqual(expect.objectContaining({ decks: 1 }));
    expect(result.cards[0]!.decks).toBe(2);
    expect(result.cards.at(-1)!.decks).toBe(1);
  });

  it("gives each deck's mainboard by card type, pitch and cost, and their average, lowest and highest across the decks", async () => {
    const source = sourceOf([hit('a', '2026-10-10T00:00:00Z'), hit('b', '2026-10-09T00:00:00Z')], {
      a: azaleaDeck('a', 'lace-with-bloodrot-red'),
      b: azaleaDeck('b', 'widowmaker-yellow'),
    });

    const result = await loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    expect(result.decks.map((deck) => deck.mainboardByType)).toEqual([
      { 'Action Arrow Attack': 22, 'Action Non-Attack': 16, 'Action Attack': 2 },
      { 'Action Arrow Attack': 24, 'Action Non-Attack': 14, 'Action Attack': 2 },
    ]);
    expect(result.decks.map((deck) => [deck.mainboardByPitch, deck.mainboardByCost])).toEqual([
      [{ red: 34, yellow: 4, blue: 2, noPitch: 0 }, { '0': 32, '1': 8 }],
      [{ red: 32, yellow: 6, blue: 2, noPitch: 0 }, { '0': 30, '1': 10 }],
    ]);
    expect(result.mainboardRange).toEqual({
      byType: {
        'Action Arrow Attack': { average: 23, min: 22, max: 24 },
        'Action Non-Attack': { average: 15, min: 14, max: 16 },
        'Action Attack': { average: 2, min: 2, max: 2 },
      },
      byPitch: {
        red: { average: 33, min: 32, max: 34 },
        yellow: { average: 5, min: 4, max: 6 },
        blue: { average: 2, min: 2, max: 2 },
        noPitch: { average: 0, min: 0, max: 0 },
      },
      byCost: { '0': { average: 31, min: 30, max: 32 }, '1': { average: 9, min: 8, max: 10 } },
    });
    expect([result.deckCount['widowmaker-yellow'], result.deckCount['boltn-shot-red'], result.deckCount['lace-with-bloodrot-red']]).toEqual([1, 2, 1]);
    expect(result.cards.find((row) => row.cardIdentifier === 'widowmaker-yellow')?.type).toBe('Action Arrow Attack');
  });

  it('caps the deck names players wrote and never returns who wrote them', async () => {
    const source = sourceOf([hit('a', '2026-10-10T00:00:00Z', { name: 'x'.repeat(300) })], { a: legalDeck('a') });

    const result = await loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    expect(result.decks[0]!.name).toHaveLength(80);
    expect(Object.keys(result.decks[0]!)).toEqual([
      'name',
      'updatedAt',
      'hasResults',
      'matchupPlans',
      'inventoryCards',
      'url',
      'mainboardByType',
      'mainboardByPitch',
      'mainboardByCost',
    ]);
  });

  it('fails when every fetch fails, so the caller can say the decks are unavailable', async () => {
    const source = sourceOf([hit('a', '2026-10-10T00:00:00Z')], { a: new Error('down') });

    await expect(loadCommunityDecks(source, { heroIdentifier: HERO, format: FORMAT, now: NOW })).rejects.toThrow();
  });
});

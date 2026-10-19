import { catalog, computeDeckLegality, ICatalogCard, TSupportedFormat } from '@rathe-arsenal/engine';
import { countByCost, countByPitch, countByType, ICountedCard, IRange, rangeAcross } from '../common/deck-counts';
import { ICommunityDeckImport, IDeckImportDto } from '../fabrary/dtos/deck-import.dto';
import { IIndexDeck, INDEX_HIT_CAP, quoted, TIndexQuery } from './fabrary-index';

export const COMMUNITY_DECKS_FETCHED = 8;
export const COMMUNITY_MAX_AGE_DAYS = 365;
export const COMMUNITY_CARD_ROWS_MAX = 60;
const COMMUNITY_NAME_MAX = 80;
const FETCH_CONCURRENCY = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMMUNITY_FILTER = 'NOT isTournament:true AND NOT isPrecon:true';

export interface ICommunityDeckSource {
  readonly query: TIndexQuery;
  readonly fetchDeck: (ulid: string) => Promise<ICommunityDeckImport>;
}

export interface ICommunityDeckRequest {
  readonly heroIdentifier: string;
  readonly format: TSupportedFormat;
  readonly now: Date;
}

export interface ICommunityDeckSummary {
  readonly name: string;
  readonly updatedAt: string;
  readonly hasResults: boolean;
  readonly matchupPlans: number;
  readonly inventoryCards: number;
  readonly url: string;
  readonly mainboardByType: Record<string, number>;
  readonly mainboardByPitch: Record<string, number>;
  readonly mainboardByCost: Record<string, number>;
}

export interface ICommunityCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly type: string | null;
  readonly slot: string;
  readonly decks: number;
  readonly averageCopies: number;
}

export interface ICommunityDecks {
  readonly inspected: number;
  readonly decks: readonly ICommunityDeckSummary[];
  readonly mainboardRange: {
    readonly byType: Record<string, IRange>;
    readonly byPitch: Record<string, IRange>;
    readonly byCost: Record<string, IRange>;
  };
  readonly cards: readonly ICommunityCard[];
  readonly deckCount: Readonly<Record<string, number>>;
}

const EMPTY_RANGE: ICommunityDecks['mainboardRange'] = { byType: {}, byPitch: {}, byCost: {} };

function careSignals(hit: IIndexDeck): number {
  return Number(hit.hasResults === true) + Number(hit.hasMatchups === true) + Number(hit.hasNotes === true);
}

function candidates(hits: readonly IIndexDeck[], request: ICommunityDeckRequest): IIndexDeck[] {
  const oldest = request.now.getTime() - COMMUNITY_MAX_AGE_DAYS * DAY_MS;
  return hits
    .filter((hit) => hit.heroIdentifier === request.heroIdentifier && hit.format === request.format && Date.parse(hit.updatedAt ?? '') >= oldest)
    .sort((a, b) => careSignals(b) - careSignals(a) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, COMMUNITY_DECKS_FETCHED);
}

function inventoryCards(deck: IDeckImportDto): number {
  return deck.inventory.reduce((sum, row) => sum + row.quantity, 0);
}

function byCompleteness(a: { hit: IIndexDeck; deck: ICommunityDeckImport }, b: { hit: IIndexDeck; deck: ICommunityDeckImport }): number {
  return (
    Number(b.hit.hasResults === true) - Number(a.hit.hasResults === true) ||
    b.deck.matchupPlans - a.deck.matchupPlans ||
    inventoryCards(b.deck) - inventoryCards(a.deck) ||
    (b.hit.updatedAt ?? '').localeCompare(a.hit.updatedAt ?? '')
  );
}

function deckRows(deck: IDeckImportDto) {
  return [...deck.mainboard, ...deck.equipment, ...deck.weapons];
}

function isCompleteAndLegal(deck: IDeckImportDto, request: ICommunityDeckRequest): boolean {
  if (deck.hero.cardIdentifier !== request.heroIdentifier) return false;
  return computeDeckLegality({ heroIdentifier: request.heroIdentifier, cards: deckRows(deck) }, catalog, request.format).category === 'legal';
}

async function fetchAll(source: ICommunityDeckSource, hits: readonly IIndexDeck[]): Promise<Array<ICommunityDeckImport | null>> {
  const fetched: Array<ICommunityDeckImport | null> = [];
  for (let start = 0; start < hits.length; start += FETCH_CONCURRENCY) {
    const batch = hits.slice(start, start + FETCH_CONCURRENCY);
    fetched.push(...(await Promise.all(batch.map((hit) => source.fetchDeck(hit.deckId).catch(() => null)))));
  }
  return fetched;
}

function findCard(cardIdentifier: string): ICatalogCard | null {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return null;
  }
}

function typeOf(card: ICatalogCard | null): string | null {
  return card ? [...card.types, ...card.subtypes].join(' ') : null;
}

function mainboardOf(deck: IDeckImportDto): ICountedCard[] {
  return deck.mainboard.flatMap((row) => {
    const card = findCard(row.cardIdentifier);
    return card ? [{ card, quantity: row.quantity }] : [];
  });
}

function makeup(deck: IDeckImportDto): Pick<ICommunityDeckSummary, 'mainboardByType' | 'mainboardByPitch' | 'mainboardByCost'> {
  const mainboard = mainboardOf(deck);
  return { mainboardByType: countByType(mainboard), mainboardByPitch: countByPitch(mainboard), mainboardByCost: countByCost(mainboard) };
}

function deckCount(decks: readonly IDeckImportDto[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const deck of decks) for (const cardIdentifier of new Set(deckRows(deck).map((row) => row.cardIdentifier))) counts.set(cardIdentifier, (counts.get(cardIdentifier) ?? 0) + 1);
  return Object.fromEntries(counts);
}

function rangesOf(makeups: readonly ReturnType<typeof makeup>[]): ICommunityDecks['mainboardRange'] {
  return {
    byType: rangeAcross(makeups.map((entry) => entry.mainboardByType)),
    byPitch: rangeAcross(makeups.map((entry) => entry.mainboardByPitch)),
    byCost: rangeAcross(makeups.map((entry) => entry.mainboardByCost)),
  };
}

function cardTotals(decks: readonly IDeckImportDto[]): ICommunityCard[] {
  const totals = new Map<string, { slot: string; decks: number; copies: number }>();
  for (const deck of decks) {
    for (const row of deckRows(deck)) {
      const total = totals.get(row.cardIdentifier) ?? { slot: row.slot, decks: 0, copies: 0 };
      totals.set(row.cardIdentifier, { ...total, decks: total.decks + 1, copies: total.copies + row.quantity });
    }
  }
  return [...totals.entries()]
    .map(([cardIdentifier, total]) => ({
      cardIdentifier,
      name: findCard(cardIdentifier)?.name ?? cardIdentifier,
      pitch: findCard(cardIdentifier)?.pitch ?? null,
      type: typeOf(findCard(cardIdentifier)),
      slot: total.slot,
      decks: total.decks,
      averageCopies: Math.round((total.copies / total.decks) * 10) / 10,
    }))
    .sort((a, b) => b.decks - a.decks || b.averageCopies - a.averageCopies || a.cardIdentifier.localeCompare(b.cardIdentifier))
    .slice(0, COMMUNITY_CARD_ROWS_MAX);
}

/** Throws when the index fails or no deck could be fetched, so the caller can say the decks are unavailable. */
export async function loadCommunityDecks(source: ICommunityDeckSource, request: ICommunityDeckRequest): Promise<ICommunityDecks> {
  const result = await source.query({
    filters: `${COMMUNITY_FILTER} AND format:${quoted(request.format)} AND heroIdentifier:${quoted(request.heroIdentifier)}`,
    hitsPerPage: INDEX_HIT_CAP,
  });
  const picked = candidates(result.hits, request);
  if (picked.length === 0) return { inspected: 0, decks: [], mainboardRange: EMPTY_RANGE, cards: [], deckCount: {} };

  const fetched = await fetchAll(source, picked);
  if (fetched.every((deck) => deck === null)) throw new Error('No community deck could be fetched from Fabrary');
  const kept = picked
    .flatMap((hit, index) => {
      const deck = fetched[index];
      return deck && isCompleteAndLegal(deck, request) ? [{ hit, deck }] : [];
    })
    .sort(byCompleteness);
  return {
    inspected: picked.length,
    decks: kept.map(({ hit, deck }) => ({
      name: hit.name.slice(0, COMMUNITY_NAME_MAX),
      updatedAt: (hit.updatedAt ?? '').slice(0, 10),
      hasResults: hit.hasResults === true,
      matchupPlans: deck.matchupPlans,
      inventoryCards: inventoryCards(deck),
      url: `https://fabrary.net/decks/${hit.deckId}`,
      ...makeup(deck),
    })),
    mainboardRange: kept.length === 0 ? EMPTY_RANGE : rangesOf(kept.map(({ deck }) => makeup(deck))),
    cards: cardTotals(kept.map(({ deck }) => deck)),
    deckCount: deckCount(kept.map(({ deck }) => deck)),
  };
}

import { createHash } from 'crypto';
import { computeUsageSignal, IUsageSignal } from './usage-signal';

/** The most recent public decks counted, one per author, as for tournament decks. */
export const PUBLIC_DECKS_MAX = 40;
/**
 * Public decks carry no event date, only their last edit, and they are the fallback for heroes and formats that few
 * players take to tournaments, often Living Legend, which changes slowly. Three years keeps those lists in.
 */
export const PUBLIC_MAX_AGE_DAYS = 1095;
/** Fewer cards than this in the mainboard, equipment and weapons is an unfinished list, not a deck someone plays. */
export const PUBLIC_DECK_MIN_CARDS = 40;
export const PUBLIC_CARD_QUANTITY_MAX = 99;

const DAY_MS = 24 * 60 * 60 * 1000;
const FABRARY_ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CARD_IDENTIFIER = /^[a-z0-9-]{1,128}$/;

/** A public deck as stored: its id, a hash of its author, its last edit and its playable card counts. */
export interface IPublicDeck {
  readonly fabraryUlid: string;
  readonly authorKey: string;
  readonly updatedAt: Date;
  /** Card identifier to copies in the mainboard, equipment and weapons. */
  readonly cards: ReadonlyMap<string, number>;
}

export type TPublicListing = Omit<IPublicDeck, 'cards'>;

/** The fields of a Fabrary index hit this module reads; anything else in the hit is ignored. */
export interface IPublicIndexHit {
  readonly deckId: string;
  readonly format: string;
  readonly heroIdentifier: string;
  readonly updatedAt?: string;
  readonly userId?: string;
}

export interface IPublicListingRequest {
  readonly heroIdentifier: string;
  readonly format: string;
  readonly now: Date;
}

export interface IPublicSelection {
  readonly now: Date;
  /** Fabrary ids left out; the quality eval holds out the decks its expected cards come from. */
  readonly excludeFabraryUlids?: readonly string[];
  /** Authors left out, so a player whose reference deck is held out cannot vote through another of his decks. */
  readonly excludeAuthorKeys?: readonly string[];
}

/** One author per key, without storing his Fabrary user id; a deck without an author counts as its own author. */
export function authorKeyOf(userId: string | undefined, fabraryUlid: string): string {
  const author = userId ? `user:${userId}` : `deck:${fabraryUlid}`;
  return createHash('sha256').update(author).digest('hex');
}

function insideWindow(updatedAt: Date, now: Date): boolean {
  return updatedAt.getTime() >= now.getTime() - PUBLIC_MAX_AGE_DAYS * DAY_MS;
}

function newestFirst(a: TPublicListing, b: TPublicListing): number {
  return b.updatedAt.getTime() - a.updatedAt.getTime() || b.fabraryUlid.localeCompare(a.fabraryUlid);
}

function newestPerAuthor<T extends TPublicListing>(decks: readonly T[]): T[] {
  const byAuthor = new Map<string, T>();
  for (const deck of [...decks].sort(newestFirst)) if (!byAuthor.has(deck.authorKey)) byAuthor.set(deck.authorKey, deck);
  return [...byAuthor.values()].slice(0, PUBLIC_DECKS_MAX);
}

/**
 * The decks a refresh fetches, from Fabrary's public index: only hits of the asked hero and format with a deck ULID and
 * a readable date inside the window, the newest per author, capped. Fabrary text such as the deck name is never kept.
 */
export function listPublicDecks(hits: readonly IPublicIndexHit[], request: IPublicListingRequest): TPublicListing[] {
  const listed = hits.flatMap((hit): TPublicListing[] => {
    const updatedAt = new Date(hit.updatedAt ?? '');
    const valid =
      FABRARY_ULID.test(hit.deckId) &&
      hit.heroIdentifier === request.heroIdentifier &&
      hit.format === request.format &&
      !Number.isNaN(updatedAt.getTime()) &&
      insideWindow(updatedAt, request.now);
    return valid ? [{ fabraryUlid: hit.deckId, authorKey: authorKeyOf(hit.userId, hit.deckId), updatedAt }] : [];
  });
  return newestPerAuthor(listed);
}

/** Keeps only catalog-shaped identifiers with a whole, bounded copy count, so nothing else from Fabrary is stored. */
export function toPublicDeck(
  listing: TPublicListing,
  rows: Iterable<{ readonly cardIdentifier: string; readonly quantity: number }>,
): IPublicDeck {
  const cards = new Map<string, number>();
  for (const row of rows) {
    const valid = CARD_IDENTIFIER.test(row.cardIdentifier) && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= PUBLIC_CARD_QUANTITY_MAX;
    if (valid) cards.set(row.cardIdentifier, (cards.get(row.cardIdentifier) ?? 0) + row.quantity);
  }
  return { ...listing, cards: new Map([...cards.entries()].filter(([, quantity]) => quantity <= PUBLIC_CARD_QUANTITY_MAX)) };
}

function isComplete(deck: IPublicDeck): boolean {
  return [...deck.cards.values()].reduce((sum, quantity) => sum + quantity, 0) >= PUBLIC_DECK_MIN_CARDS;
}

/** The share of the newest complete public deck of each author that play each card; null below the minimum. */
export function publicUsageSignal(decks: readonly IPublicDeck[], selection: IPublicSelection): IUsageSignal | null {
  const excludedDecks = new Set(selection.excludeFabraryUlids ?? []);
  const excludedAuthors = new Set(selection.excludeAuthorKeys ?? []);
  const eligible = decks.filter(
    (deck) =>
      !excludedDecks.has(deck.fabraryUlid) &&
      !excludedAuthors.has(deck.authorKey) &&
      insideWindow(deck.updatedAt, selection.now) &&
      deck.updatedAt.getTime() <= selection.now.getTime() &&
      isComplete(deck),
  );
  const rows = newestPerAuthor(eligible).flatMap((deck) =>
    [...deck.cards.keys()].map((cardIdentifier) => ({ deckId: deck.fabraryUlid, cardIdentifier })),
  );
  return computeUsageSignal(rows, 'public');
}

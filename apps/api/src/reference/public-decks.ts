import { IDeckImportDto } from '../fabrary/dtos/deck-import.dto';
import { IPublicDeck, IPublicListingRequest, listPublicDecks, toPublicDeck, TPublicListing } from '../recommendations/public-deck-usage';
import { INDEX_HIT_CAP, quoted, TIndexQuery } from './fabrary-index';

/** Decks players shared on Fabrary: neither a tournament list nor a preconstructed product. */
export const PUBLIC_DECK_FILTER = 'NOT isTournament:true AND NOT isPrecon:true';
const FETCH_CONCURRENCY = 4;

export interface IPublicDeckSource {
  readonly query: TIndexQuery;
  readonly fetchDeck: (fabraryUlid: string) => Promise<IDeckImportDto>;
}

/** Where public decks of one hero and format are kept between refreshes. */
export interface IPublicDeckStore {
  /** The last edit each stored deck had when it was fetched. */
  storedVersions(heroIdentifier: string, format: string): Promise<ReadonlyMap<string, Date>>;
  save(heroIdentifier: string, format: string, deck: IPublicDeck): Promise<void>;
  /** Deletes the stored decks of the hero and format that are not in the list. */
  keepOnly(heroIdentifier: string, format: string, fabraryUlids: readonly string[]): Promise<void>;
  markRefreshed(heroIdentifier: string, format: string, at: Date, decks: number): Promise<void>;
}

export interface IPublicRefreshSummary {
  readonly listed: number;
  readonly fetched: number;
  readonly failed: number;
  readonly kept: number;
}

async function fetchListed(source: IPublicDeckSource, listings: readonly TPublicListing[], heroIdentifier: string): Promise<Array<IPublicDeck | null>> {
  const decks: Array<IPublicDeck | null> = [];
  for (let start = 0; start < listings.length; start += FETCH_CONCURRENCY) {
    const batch = listings.slice(start, start + FETCH_CONCURRENCY);
    const fetched = await Promise.all(batch.map((listing) => source.fetchDeck(listing.fabraryUlid).catch(() => null)));
    decks.push(
      ...fetched.map((deck, index) =>
        // A deck whose hero changed since the index listed it would vote for another hero's cards.
        deck && deck.hero.cardIdentifier === heroIdentifier ? toPublicDeck(batch[index]!, [...deck.mainboard, ...deck.equipment, ...deck.weapons]) : null,
      ),
    );
  }
  return decks;
}

/**
 * Brings the stored public decks of one hero and format up to date with Fabrary: lists them in the public index,
 * fetches only those new or edited since they were stored, and forgets those no longer listed. Throws, leaving the
 * store as it was, when the index fails or none of the decks to fetch could be read.
 */
export async function refreshPublicDecks(
  source: IPublicDeckSource,
  store: IPublicDeckStore,
  request: IPublicListingRequest,
): Promise<IPublicRefreshSummary> {
  const { heroIdentifier, format } = request;
  const result = await source.query({
    filters: `${PUBLIC_DECK_FILTER} AND format:${quoted(format)} AND heroIdentifier:${quoted(heroIdentifier)}`,
    hitsPerPage: INDEX_HIT_CAP,
  });
  const listed = listPublicDecks(result.hits, request);
  const stored = await store.storedVersions(heroIdentifier, format);
  const stale = listed.filter((listing) => stored.get(listing.fabraryUlid)?.getTime() !== listing.updatedAt.getTime());
  const fetched = (await fetchListed(source, stale, heroIdentifier)).filter((deck): deck is IPublicDeck => deck !== null);
  if (stale.length > 0 && fetched.length === 0) throw new Error('No public deck could be fetched from Fabrary');

  for (const deck of fetched) await store.save(heroIdentifier, format, deck);
  const fetchedIds = new Set(fetched.map((deck) => deck.fabraryUlid));
  const kept = listed.filter((listing) => stored.has(listing.fabraryUlid) || fetchedIds.has(listing.fabraryUlid)).map((listing) => listing.fabraryUlid);
  await store.keepOnly(heroIdentifier, format, kept);
  await store.markRefreshed(heroIdentifier, format, request.now, kept.length);
  return { listed: listed.length, fetched: fetched.length, failed: stale.length - fetched.length, kept: kept.length };
}

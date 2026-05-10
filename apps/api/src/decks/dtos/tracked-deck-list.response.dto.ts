import { IShoppingLineAggregate } from '../../stores/dtos/shopping-line.response.dto';

export { IShoppingLineAggregate };

/**
 * Card preview returned for the home tile's hover-open animation. Up to 3
 * representative mainboard cards are returned per deck, ranked by quantity
 * desc + name asc. The list is empty when the deck has no snapshot yet
 * (the frontend renders default oxblood card-back silhouettes in that case).
 *
 * `imageUrl.small` is the preferred URL (matches the engine's primary).
 * `imageUrl.smallSources` is the full ordered fallback list — when the
 * primary URL fails to load (Legend Story's CDN 403's some assets despite
 * the catalog producing a stable URL), the frontend walks this list to find
 * a working alternate. The `large` URL is deliberately omitted because these
 * thumbnails are decorative.
 */
export interface IRepresentativeCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly imageUrl: {
    readonly small: string;
    readonly smallSources: readonly string[];
  } | null;
}

export interface ITrackedDeckListItem {
  readonly id: number;
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  readonly latestSnapshot: {
    readonly rawPercent: number;
    readonly effectivePercent: number;
    readonly computedAt: string;
  } | null;
  /**
   * URL for the hero card thumbnail. Sourced from the catalog's hero entry
   * (matched by `hero` name, lower-cased, hyphenated). Null when no match
   * is found in the catalog (e.g., a hero introduced after the catalog was
   * compiled, or a typo in the upstream deck import).
   *
   * `smallSources` is an ordered fallback list (same contract as
   * `IRepresentativeCard.imageUrl.smallSources`). The frontend walks it on
   * `onError` because Legend Story's CDN 403's some primary assets despite
   * the catalog producing a stable URL.
   */
  readonly heroImageUrl: {
    readonly small: string;
    readonly smallSources: readonly string[];
  } | null;
  /**
   * Up to 3 representative mainboard cards for the home tile's hover-open
   * animation. Empty array when no snapshot has been computed yet.
   */
  readonly representativeCards: readonly IRepresentativeCard[];
}

/**
 * Response envelope for `GET /api/decks`.
 *
 * The response is an object (not a bare array) so that collection-level state
 * (e.g. `collectionCardCount`) can travel alongside the deck list without
 * requiring an extra request. `collectionCardCount` is exposed in Phase 1a
 * for the home state machine and forward-compatibility with the Phase 1c
 * three-mode fallback state.
 *
 * `aggregateShoppingLine` is wired in U10 for the home callout card.
 * null = no tracked decks with missing cards (Path A on all decks).
 */
export interface ITrackedDeckListResponse {
  readonly trackedDecks: readonly ITrackedDeckListItem[];
  readonly collectionCardCount: number;
  /** Aggregate shopping line across all tracked decks. Null when not applicable. */
  readonly aggregateShoppingLine: IShoppingLineAggregate | null;
}

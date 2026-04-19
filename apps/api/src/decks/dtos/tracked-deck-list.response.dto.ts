import { IShoppingLineAggregate } from '../../stores/dtos/shopping-line.response.dto';

export { IShoppingLineAggregate };

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

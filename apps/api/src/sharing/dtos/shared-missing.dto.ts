import type { TStoreState } from '../../stores/store-state';
import type { ISharedCard } from './shared-deck.dto';

/** A card the owner still needs, as the group page shows it: what the store answered, and the visitor's own count. */
export interface ISharedMissingCard extends ISharedCard {
  readonly state: TStoreState;
  readonly unitPriceCents: number | null;
  readonly lineCents: number | null;
  /** Copies the store can supply of the ones needed; null unless the card is priced. */
  readonly availableCopies: number | null;
  readonly foilOnly: boolean;
  readonly promoOnly: boolean;
  readonly productUrl: string | null;
  /** What the signed-in visitor owns of the card; null for an anonymous visitor and for the owner. */
  readonly owned: number | null;
}

export interface IStoreSummary {
  readonly copies: number;
  readonly cents: number;
}

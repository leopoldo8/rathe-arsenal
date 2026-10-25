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

export interface ISharedQuoteItem {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  /** The small card image address; null when the card has none. */
  readonly imageUrl: string | null;
  readonly quantity: number;
}

/** What a `quote` address answers: who asks and what is needed, and nothing about any store. */
export interface ISharedQuoteResponse {
  readonly intent: 'quote';
  readonly name: string;
  readonly hero: string;
  readonly sharerName: string;
  readonly contactWhatsapp: string | null;
  readonly needed: readonly ISharedQuoteItem[];
}

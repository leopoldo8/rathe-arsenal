import { TDeckShareIntent } from '../../database/entities/share-link.entity';

export interface ISharedCardImage {
  small: string;
  large: string;
  sources: { small: string; large: string }[];
}

export interface ISharedCard {
  cardIdentifier: string;
  name: string;
  pitch: 1 | 2 | 3 | null;
  type: string;
  slot: string;
  quantity: number;
  /** Copies carried in the inventory beside `quantity` (door 3); 0 when none. */
  inventoryQuantity: number;
  imageUrl: ISharedCardImage | null;
}

export interface ISharedFormatVerdict {
  category: 'legal' | 'incomplete' | 'illegal' | 'unchecked';
  details: { code: string; params: Record<string, unknown> }[];
}

export interface ISharedDeckLegality extends ISharedFormatVerdict {
  heroYoung: boolean | null;
  otherFormats: (ISharedFormatVerdict & { format: string })[];
}

export interface ISharedDeckResponse {
  intent: TDeckShareIntent;
  token: string;
  url: string;
  name: string;
  hero: string;
  heroIdentifier: string | null;
  heroCard: ISharedCard | null;
  format: string;
  sharerName: string;
  contactWhatsapp: string | null;
  isOwner: boolean;
  /** Only the owner gets the id: the web owner view links to the deck's sharing controls. */
  deckId: number | null;
  updatedAt: string;
  totalCards: number;
  /** Every card for the 'deck' intent; empty for 'missing'. */
  cards: ISharedCard[];
  /** The owner's missing cards for the 'missing' intent; empty for 'deck', enforced here and not only in the UI. */
  missing: ISharedCard[];
  missingCount: number;
  /** The deck's verdict in its own format and in the others, for the 'deck' intent; null for 'missing'. */
  legality: ISharedDeckLegality | null;
}

export interface ISharedDeckCoverage {
  ownedCopies: number;
  totalCopies: number;
  percent: number;
  /** True when the visitor owns no copy at all, so the page says how to put cards in instead of showing 0%. */
  collectionEmpty: boolean;
}

export interface ISharedDeckMatches {
  cards: { cardIdentifier: string; owned: number }[];
}

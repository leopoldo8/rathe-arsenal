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
  imageUrl: ISharedCardImage | null;
}

export interface ISharedDeckResponse {
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
  cards: ISharedCard[];
  missing: ISharedCard[];
  missingCount: number;
}

export interface ISharedDeckCoverage {
  ownedCopies: number;
  totalCopies: number;
  percent: number;
}

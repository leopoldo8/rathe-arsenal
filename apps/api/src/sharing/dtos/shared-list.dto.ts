import { TCondition } from '../../database/entities/card-list-line.entity';
import { TListKind } from '../../database/entities/card-list.entity';
import { ICopyVersion } from '../../collection/versions/copy-version';
import { ISharedCardImage } from './shared-deck.dto';

export interface ISharedListLine {
  id: number;
  cardIdentifier: string;
  name: string;
  pitch: 1 | 2 | 3 | null;
  type: string;
  imageUrl: ISharedCardImage | null;
  quantity: number;
  printingLabel: string | null;
  /** Sell lists: the version the seller named; `''` where they did not, and always `''` on a want list. */
  printingCode: string;
  edition: string;
  finish: string;
  /** Sell lists: the set the printing code belongs to, when the catalog knows it. */
  setName: string | null;
  condition: TCondition | null;
  priceCents: number | null;
  sold: boolean;
  /** Want lists, signed-in visitor who is not the owner: what the visitor owns of the card; null otherwise. */
  owned: number | null;
  /** The visitor's spare copies from the one spare function; null for anyone else and while the rule question is owed. */
  spare: number | null;
  /** Why none is spare: the holding deck that keeps the most copies and how many it keeps; null while some are spare, and for anyone but a visitor of a want list. */
  spareReason: { deckName: string; copies: number } | null;
  /** The one version every spare copy of the card has, when they agree; null otherwise. */
  spareVersion: (ICopyVersion & { setName: string | null }) | null;
  /** TCGplayer in dollars times 7, in reais as cents, for a card of a want list a signed-in visitor looks at; null when no printing is priced. */
  suggestedCents: number | null;
}

/** A signed-in visitor's own shared want list, offered to the sharer in return. */
export interface ISharedVisitorList {
  name: string;
  url: string;
  lines: {
    cardIdentifier: string;
    name: string;
    pitch: 1 | 2 | 3 | null;
    quantity: number;
    suggestedCents: number | null;
  }[];
}

export interface ISharedListResponse {
  kind: TListKind;
  token: string;
  url: string;
  name: string;
  notes: string | null;
  sharerName: string;
  contactWhatsapp: string | null;
  isOwner: boolean;
  /** Only the owner gets the id: the web owner view links to the editor. */
  listId: number | null;
  /** Sell lists only. */
  totalPriceCents: number | null;
  updatedAt: string;
  /** True when a signed-in visitor of a want list must answer the spare-rule question before any spare count is shown. */
  spareNeedsRule: boolean;
  /** Want lists, signed-in visitor who is not the owner: the visitor's most recent want list that has a live link and cards; null otherwise. */
  visitorList: ISharedVisitorList | null;
  /** Every line, sold included, in the list's order. */
  lines: ISharedListLine[];
}

export interface ISharedListLineMatch {
  lineId: number;
  owned: number;
  missingInDecks: number;
  /** Sell lists: each of the visitor's decks that misses the card, with that deck's own count (their sum is `missingInDecks`). */
  decks: { deckId: number; deckName: string; missing: number }[];
}

export interface ISharedListMatches {
  lines: ISharedListLineMatch[];
}

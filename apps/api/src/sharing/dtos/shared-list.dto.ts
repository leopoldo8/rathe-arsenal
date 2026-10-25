import { TCondition } from '../../database/entities/card-list-line.entity';
import { TListKind } from '../../database/entities/card-list.entity';
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
  condition: TCondition | null;
  priceCents: number | null;
  sold: boolean;
  /** Want lists, signed-in visitor who is not the owner: what the visitor owns of the card; null otherwise. */
  owned: number | null;
  /** The visitor's spare copies from the one spare function; null for anyone else and while the rule question is owed. */
  spare: number | null;
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
  /** Every line, sold included, in the list's order. */
  lines: ISharedListLine[];
}

export interface ISharedListLineMatch {
  lineId: number;
  owned: number;
  missingInDecks: number;
}

export interface ISharedListMatches {
  lines: ISharedListLineMatch[];
}

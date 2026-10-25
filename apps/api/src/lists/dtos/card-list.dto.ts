import { TCondition } from '../../database/entities/card-list-line.entity';
import { TListKind } from '../../database/entities/card-list.entity';

export interface ICardImage {
  small: string;
  large: string;
  sources: { small: string; large: string }[];
}

export interface IPriceSuggestion {
  cents: number;
  approximate: boolean;
  fetchedAt: string;
  printing: string;
}

export interface ICardListSummary {
  id: number;
  kind: TListKind;
  name: string;
  lineCount: number;
  copyCount: number;
  soldCount: number;
  totalPriceCents: number | null;
  previewImages: ICardImage[];
  shared: boolean;
  updatedAt: string;
}

export interface ICardListLine {
  id: number;
  cardIdentifier: string;
  name: string;
  pitch: 1 | 2 | 3 | null;
  type: string;
  imageUrl: ICardImage | null;
  quantity: number;
  /** The version of the line (door 1); `''` is "Não sei". */
  printingCode: string;
  edition: '' | 'first' | 'unlimited' | 'alpha';
  finish: '' | 'none' | 'rainbow' | 'cold' | 'gold';
  /** The catalog printing the version points at, as a key; null while no printing code is named. */
  printing: string | null;
  printingLabel: string | null;
  condition: TCondition | null;
  priceCents: number | null;
  sold: boolean;
  suggestion: IPriceSuggestion | null;
  /** Sell lists: the copies of the card in the player's collection, whatever the version; null on a want list. */
  owned: number | null;
}

export interface ICardList {
  id: number;
  kind: TListKind;
  name: string;
  notes: string | null;
  totalPriceCents: number | null;
  priceMultiplier: number | null;
  lines: ICardListLine[];
  updatedAt: string;
}

export interface IListPrintingOption {
  printing: string;
  printingCode: string;
  edition: '' | 'first' | 'unlimited' | 'alpha';
  finish: '' | 'none' | 'rainbow' | 'cold' | 'gold';
  label: string;
  suggestion: IPriceSuggestion | null;
}

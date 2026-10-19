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
  printing: string | null;
  printingLabel: string | null;
  condition: TCondition | null;
  priceCents: number | null;
  sold: boolean;
  suggestion: IPriceSuggestion | null;
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
  label: string;
  suggestion: IPriceSuggestion | null;
}

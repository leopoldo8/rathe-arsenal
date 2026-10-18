export interface IPriceRow {
  readonly productId: number;
  readonly subTypeName: string;
  readonly lowPrice: number | null;
  readonly midPrice: number | null;
  readonly highPrice: number | null;
  readonly marketPrice: number | null;
  readonly directLowPrice: number | null;
}

export interface IRawPrinting {
  readonly identifier: string;
  readonly set: string;
  readonly rarity: string;
  readonly foiling?: string;
  readonly edition?: string;
  readonly tcgplayer?: { readonly productId: string; readonly url: string };
}

export interface ICardSetPrinting {
  readonly identifier: string;
  readonly set: string;
  readonly rarity: string;
  readonly foiling: string;
  readonly edition: string | null;
  readonly productId: number | null;
}

export interface ICardSetEntry {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly printings: readonly ICardSetPrinting[];
}

export interface ICardCoverage {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly printingsTotal: number;
  readonly printingsPriced: number;
  readonly best: {
    readonly printing: ICardSetPrinting;
    readonly row: IPriceRow;
  } | null;
}

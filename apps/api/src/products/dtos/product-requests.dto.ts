import { IsBoolean, IsOptional } from 'class-validator';

export class SearchProductsQueryDto {
  @IsOptional()
  q?: string;
}

/** Body of `POST /api/products/:productKey/import`: the two switches of the confirm screen. */
export class ImportProductDto {
  @IsBoolean()
  addCards!: boolean;

  @IsBoolean()
  createDeck!: boolean;

  /** Sent after the player agreed to add a second box of the same product. */
  @IsOptional()
  @IsBoolean()
  confirmRepeat?: boolean;
}

export interface IProductCardView {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly quantity: number;
}

export interface IProductView {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  /** Classic Constructed, Blitz or Silver Age. */
  readonly format: string;
  readonly cardCount: number;
  readonly hero: {
    readonly cardIdentifier: string;
    readonly name: string;
    readonly imageUrl: { readonly small: string; readonly large: string } | null;
  };
  readonly cards: readonly IProductCardView[];
}

export interface IProductsResponse {
  readonly products: readonly IProductView[];
}

export interface IImportProductResponse {
  readonly source?: {
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly cardCount: number;
    readonly copies: number;
  };
  readonly deckId?: number;
}

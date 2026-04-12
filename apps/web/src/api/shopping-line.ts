/**
 * Shopping line response types shared across deck-detail and test-mode APIs.
 *
 * The discriminated union mirrors the server's `IShoppingLineResponse` DTO:
 *  - null        = Path A (no missing cards, "you have everything you need")
 *  - 'unscraped' = store_stock has zero rows; hide section entirely
 *  - 'error'     = computation failed server-side; show degraded state
 *  - 'populated' = real data available; render the full shopping line
 */

export interface IShoppingLineLine {
  readonly cardIdentifier: string;
  readonly cardName: string;
  readonly quantityNeeded: number;
  readonly quantityAvailable: number;
  /** Null when price is on-request ("sob consulta"). */
  readonly unitPriceCents: number | null;
  readonly productUrl: string;
  readonly lastFetchedAt: string;
}

export interface IShoppingLinePopulated {
  readonly kind: 'populated';
  readonly storeName: string;
  readonly storeHostname: string;
  readonly totalCostCents: number;
  readonly availableCardCount: number;
  readonly unavailableCardCount: number;
  readonly lines: readonly IShoppingLineLine[];
  readonly lastFetchedAt: string;
}

export interface IShoppingLineUnscraped {
  readonly kind: 'unscraped';
}

export interface IShoppingLineError {
  readonly kind: 'error';
  readonly reason: string;
}

export type IShoppingLineResponse =
  | IShoppingLinePopulated
  | IShoppingLineUnscraped
  | IShoppingLineError;

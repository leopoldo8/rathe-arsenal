/**
 * One line in the shopping cart: a single card that is missing from the
 * deck and may or may not be in stock at the store.
 */
export interface IShoppingLine {
  readonly cardIdentifier: string;
  /** Catalog-sourced name (trusted; not from scraped data). */
  readonly cardName: string;
  readonly pitch: number | null;
  readonly quantityNeeded: number;
  /**
   * min(stock.quantity, quantityNeeded).
   * Zero when the card is unavailable or price is null.
   */
  readonly quantityAvailable: number;
  /** Null when stock.priceCents is null ("Sob consulta"). */
  readonly unitPriceCents: number | null;
  /**
   * Validated product URL. Blank string when the row fails the S10
   * hostname pre-check at read time (belt-and-suspenders).
   */
  readonly productUrl: string;
  /** ISO 8601 timestamp of when this row was last written by the scraper. */
  readonly lastFetchedAt: string;
}

/**
 * Secondary section: substituted cards whose raw originals are still
 * missing from the physical collection (Path B only). Identical shape to
 * IShoppingLine but scoped to upgrade candidates rather than primary missing.
 */
export interface IShoppingLineUpgradeCandidate {
  readonly cardIdentifier: string;
  readonly cardName: string;
  readonly pitch: number | null;
  readonly quantityNeeded: number;
  readonly quantityAvailable: number;
  readonly unitPriceCents: number | null;
  readonly productUrl: string;
  readonly lastFetchedAt: string;
}

/** The populated data shape — store has stock rows for this user's missing cards. */
export interface IShoppingLinePopulated {
  readonly kind: 'populated';
  readonly storeName: string;
  readonly storeSlug: string;
  /** Exact hostname extracted from store.baseUrl (e.g. 'www.cupuladt.com.br'). */
  readonly storeHostname: string;
  /**
   * Sum of min(quantityNeeded, quantityAvailable) * unitPriceCents across
   * all lines where quantityAvailable > 0 AND unitPriceCents is not null.
   */
  readonly totalCostCents: number;
  /** Lines where quantityAvailable > 0. */
  readonly availableCardCount: number;
  /** Lines where quantityAvailable === 0 (not in stock or price is null). */
  readonly unavailableCardCount: number;
  /**
   * Oldest lastFetchedAt across all lines (worst-case freshness).
   * ISO 8601 string.
   */
  readonly lastFetchedAt: string;
  /** Primary section: cards from breakdown.missing. */
  readonly lines: readonly IShoppingLine[];
  /**
   * Secondary section: raw originals of substituted cards (Path B only).
   * Empty array on Path A / Path C.
   */
  readonly upgradeCandidates: readonly IShoppingLineUpgradeCandidate[];
}

/** The store exists but has no stock rows yet (pre-scrape state). */
export interface IShoppingLineUnscraped {
  readonly kind: 'unscraped';
}

/**
 * Server-side computation failed (store missing, DB error, etc.).
 * Frontend must not conflate this with null (Path A).
 */
export interface IShoppingLineError {
  readonly kind: 'error';
  readonly reason: string;
}

/**
 * Discriminated union. `null` means Path A (no missing cards — nothing to buy).
 * The union members cover the three non-null states:
 *   - populated: real data available
 *   - unscraped: store exists but no stock rows yet
 *   - error: computation failed
 */
export type IShoppingLineResponse =
  | IShoppingLinePopulated
  | IShoppingLineUnscraped
  | IShoppingLineError;

/**
 * Aggregate shopping line for the home deck list.
 * One row per user summarising "R$ 312 completaria 4 de 6 decks".
 */
export interface IShoppingLineAggregate {
  readonly storeName: string;
  readonly storeSlug: string;
  readonly totalCostCents: number;
  /** Number of tracked decks where buying available cards reaches 100%. */
  readonly decksCompletable: number;
  /** Total number of tracked decks that have at least one missing card. */
  readonly totalDecks: number;
}

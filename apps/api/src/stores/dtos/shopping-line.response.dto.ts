/**
 * Variant verification status for a shopping line card.
 *
 * NEVER_CHECKED: no variant data has been fetched for this card yet.
 * VERIFIED_ZERO: variant data exists but all variants have quantity 0
 *   (the store genuinely has no copies of this variant combination).
 */
export enum EVariantVerificationStatus {
  /**
   * No variant data has been fetched for this card yet.
   * The service leaves verificationStatus absent (undefined) on listing-fallback
   * lines rather than explicitly setting this value. This member is reserved for
   * Unit 5+ (API endpoint / DTO serialization) where explicit population may be
   * needed for frontend state discrimination.
   */
  NEVER_CHECKED = 'never_checked',
  /**
   * Variant data was fetched and all variants have quantity 0.
   * The store genuinely has no in-stock copies of any variant.
   */
  VERIFIED_ZERO = 'verified_zero',
}

/**
 * A single variant row from the store's detail page, representing one
 * (edition, condition, finish) combination with its price and quantity.
 */
export interface IShoppingLineVariant {
  readonly edition: string;
  readonly condition: string;
  readonly finish: string;
  readonly priceCents: number;
  readonly quantity: number;
}

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
  /**
   * Cheapest available variant price (display only).
   * For variant lines: cheapest variant priceCents.
   * For listing lines: listing priceCents.
   * Null when no price is available.
   * NOT used for cost rollup — use lineCostCents instead.
   */
  readonly unitPriceCents: number | null;
  /**
   * Validated product URL. Blank string when the row fails the S10
   * hostname pre-check at read time (belt-and-suspenders).
   */
  readonly productUrl: string;
  /** ISO 8601 timestamp of when this row was last written by the scraper. */
  readonly lastFetchedAt: string;

  // -------------------------------------------------------------------------
  // Variant-aware fields (Unit 4+)
  // -------------------------------------------------------------------------

  /**
   * Whether this line has fresh variant data from the detail page.
   * False for listing-only lines (no detail fetch yet or stale data).
   */
  readonly hasVariantData: boolean;

  /**
   * The data source used for this line's cost computation.
   * 'variant': greedy cheapest-first allocation from variant rows.
   * 'listing': fallback to listing-level price × quantity.
   */
  readonly dataSource: 'listing' | 'variant';

  /**
   * Total cost for this line in cents.
   * For variant lines: result of greedy cheapest-first allocation.
   * For listing lines: quantityAvailable * unitPriceCents (backward-compatible).
   * Zero when quantityAvailable is 0 or price is null.
   */
  readonly lineCostCents: number;

  /**
   * Individual variant rows sorted by priceCents ascending.
   * Only present when hasVariantData is true.
   */
  readonly variants?: readonly IShoppingLineVariant[];

  /**
   * Verification status for cards that have been detail-fetched.
   * Absent when hasVariantData is false (never_checked is implicit).
   * VERIFIED_ZERO when variant rows exist but all quantities are 0.
   */
  readonly verificationStatus?: EVariantVerificationStatus;
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
   * Sum of line.lineCostCents across all lines.
   * For variant lines: greedy cheapest-first allocation sum.
   * For listing lines: quantityAvailable * unitPriceCents (backward-compatible).
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
  /**
   * True when ANY line lacks variant data (hasVariantData === false).
   * Indicates the headline totalCostCents may be a listing-level estimate.
   * False only when all lines have fresh variant data.
   */
  readonly isEstimated: boolean;
  /**
   * In-memory progress for an active or recently completed variant fetch.
   * Absent when no fetch has been started (or the 5-minute TTL has expired).
   * Frontend polls on this field to drive the loading indicator.
   *
   * Unit 5: populated by DecksService.getDetail() via VariantFetchService.getProgress().
   * NOT present on IShoppingLineAggregate (deck list).
   */
  readonly variantFetchProgress?: IVariantFetchProgressDto;
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
 * Per-card fetch status surfaced to the frontend.
 *
 * - `pending`: card has not yet been processed in the current fetch loop.
 * - `done`: card was fetched and parsed successfully.
 * - `failed`: the detail fetch or parse failed for this card; row-level
 *   failure annotation should be shown on the matching IShoppingLine.
 */
export type TCardFetchStatusDto = 'pending' | 'done' | 'failed';

/**
 * Public DTO shape for variant fetch progress.
 *
 * Serializes the 5 aggregate fields from IVariantFetchProgress plus a
 * per-card status map keyed by cardIdentifier. Internal fields
 * (startedAt, globalFailed) remain private.
 */
export interface IVariantFetchProgressDto {
  readonly fetchId: string;
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly inProgress: boolean;
  /**
   * Per-card status keyed by cardIdentifier. Absent on progress records
   * whose tracker did not collect card status (backward compatibility).
   */
  readonly cards?: Readonly<Record<string, TCardFetchStatusDto>>;
}

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

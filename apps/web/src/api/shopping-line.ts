/**
 * Shopping line response types shared across deck-detail and test-mode APIs.
 *
 * The discriminated union mirrors the server's `IShoppingLineResponse` DTO:
 *  - null        = Path A (no missing cards, "you have everything you need")
 *  - 'unscraped' = store_stock has zero rows; hide section entirely
 *  - 'error'     = computation failed server-side; show degraded state
 *  - 'populated' = real data available; render the full shopping line
 */

/**
 * Per-card fetch status.
 * Mirrors `TCardFetchStatusDto` on the backend.
 */
export type TCardFetchStatus = 'pending' | 'done' | 'failed';

/**
 * Mirrors `IVariantFetchProgressDto` on the backend.
 * Present on `IShoppingLinePopulated` when a detail fetch is actively
 * running (or recently completed but not yet cleaned up by the 5-min TTL).
 * Absence means either no fetch has been triggered, the fetch completed
 * and the TTL evicted the entry, or the server pod restarted mid-fetch.
 */
export interface IVariantFetchProgress {
  readonly fetchId: string;
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  /** False when all cards have been processed (success or per-card failure). */
  readonly inProgress: boolean;
  /**
   * Per-card status keyed by cardIdentifier. Absent on older responses or
   * when the backend progress entry was created without status tracking.
   */
  readonly cards?: Readonly<Record<string, TCardFetchStatus>>;
}

/**
 * Variant verification status for a shopping line card.
 * Mirrors `EVariantVerificationStatus` on the backend.
 *
 * When absent from a line, treat as 'never_checked' (no detail fetch yet).
 * 'verified_zero' means variant data was fetched and all variants have qty 0.
 */
export type TVariantVerificationStatus = 'never_checked' | 'verified_zero';

/**
 * A single variant row from the store's detail page.
 * Mirrors `IShoppingLineVariant` on the backend DTO.
 */
export interface IShoppingLineVariant {
  readonly edition: string;
  readonly condition: string;
  /**
   * Finish label from the store. Common values: 'Non-foil', 'Rainbow Foil',
   * 'Cold Foil', 'Gold Foil'. The display layer normalises non-foil finishes
   * to "Non-foil"; any other value is shown as-is and treated as foil.
   */
  readonly finish: string;
  readonly priceCents: number;
  readonly quantity: number;
}

export interface IShoppingLineLine {
  readonly cardIdentifier: string;
  readonly cardName: string;
  readonly quantityNeeded: number;
  readonly quantityAvailable: number;
  /** Null when price is on-request ("sob consulta"). */
  readonly unitPriceCents: number | null;
  readonly productUrl: string;
  readonly lastFetchedAt: string;
  /**
   * True when this line's price comes from detailed variant data rather
   * than a listing-page estimate. Added in the variant-aware shopping line
   * feature (Unit 5+). Absent on older responses (treat as false).
   */
  readonly hasVariantData?: boolean;
  /**
   * Cost allocated for this line using greedy cheapest-first allocation
   * across variants. For listing-only lines, equals
   * `min(quantityNeeded, quantityAvailable) * unitPriceCents`.
   * Absent on older responses.
   */
  readonly lineCostCents?: number;
  /**
   * The data source used for this line's cost computation.
   * 'variant': greedy cheapest-first allocation from variant rows.
   * 'listing': fallback to listing-level price.
   * Absent on older responses (treat as 'listing').
   */
  readonly dataSource?: 'listing' | 'variant';
  /**
   * Individual variant rows sorted by priceCents ascending.
   * Only present when hasVariantData is true.
   */
  readonly variants?: readonly IShoppingLineVariant[];
  /**
   * Verification status for cards that have been detail-fetched.
   * Absent when hasVariantData is false (never_checked is implicit).
   * 'verified_zero' when variant rows exist but all quantities are 0.
   */
  readonly verificationStatus?: TVariantVerificationStatus;
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
  /**
   * True when at least one line uses a listing-page estimate rather than
   * detailed variant data. Present on deck-detail responses from Unit 5+.
   * When absent, treat as false (no variant feature active).
   */
  readonly isEstimated?: boolean;
  /**
   * Progress of an active (or recently completed) detail fetch for this
   * deck. Present only while the backend progress tracker holds an entry.
   * Absence is a valid stop condition for polling (pod restart, TTL eviction,
   * or fetch never started). Do NOT rely solely on `inProgress === false`.
   */
  readonly variantFetchProgress?: IVariantFetchProgress;
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

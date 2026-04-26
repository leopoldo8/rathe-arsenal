/**
 * Response shape for GET /api/collection/library.
 *
 * Each entry in `cards` represents one distinct card the user owns
 * (summed across all active sources). The `stats` block aggregates
 * collection-level metrics including estimated market value derived from
 * store_stock min-price data.
 */

export interface ILibraryCard {
  readonly cardIdentifier: string;
  readonly name: string;
  /** Pitch value (1=red, 2=yellow, 3=blue) or null for equipment/weapons/etc. */
  readonly pitch: number | null;
  readonly types: readonly string[];
  readonly classes: readonly string[];
  /**
   * Talent identifiers (e.g. `["lightning"]`, `["earth"]`, `["light","shadow"]`).
   * Empty array when the card has no talent (most generic cards). Sourced from
   * the engine catalog.
   */
  readonly talents: readonly string[];
  /** Short set-code identifiers (e.g. ["WTR", "CRU"]). */
  readonly sets: readonly string[];
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  /** Summed quantity owned across all active sources. */
  readonly ownedQuantity: number;
}

export interface IPitchBreakdown {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
  readonly colorless: number;
}

export interface ILibraryStats {
  /** Number of distinct card identifiers with summed qty > 0. */
  readonly uniqueCount: number;
  /** Sum of all ownedQuantity values. */
  readonly totalCopies: number;
  /**
   * Per-pitch-bucket quantity totals.
   * - red: pitch === 1
   * - yellow: pitch === 2
   * - blue: pitch === 3
   * - colorless: pitch === null (equipment, weapons, heroes, etc.)
   */
  readonly pitchBreakdown: IPitchBreakdown;
  /**
   * SUM(ownedQuantity * MIN(priceCents)) across all owned identifiers that
   * have at least one in-stock store_stock row (quantity > 0, priceCents
   * non-null). Identifiers with no matching stock row contribute 0.
   * Value is in BRL cents.
   */
  readonly estimatedValueCents: number;
  /**
   * Number of distinct identifiers that contributed a non-zero minPriceCents
   * to estimatedValueCents. Enables the frontend to surface a
   * "N/M cards priced" transparency label.
   */
  readonly pricedIdentifierCount: number;
  /**
   * ISO-8601 string of MAX(lastFetchedAt) across all store_stock rows,
   * or null when store_stock is empty. Powers the freshness indicator (R32).
   */
  readonly priceDataLastUpdatedAt: string | null;
}

export interface ILibraryResponse {
  readonly cards: readonly ILibraryCard[];
  readonly stats: ILibraryStats;
  /**
   * Map of set codes appearing in `cards[].sets` to their human-readable
   * release names (e.g. `{ "WTR": "Welcome to Rathe", "HVY": "Heavy Hitters" }`).
   *
   * Only includes codes the engine recognises — unknown codes are omitted, so
   * the frontend should still display the bare code as a fallback. Built once
   * per response to avoid pushing the full 109-entry mapping for every request.
   */
  readonly setNames: Readonly<Record<string, string>>;
}

/**
 * Response body for `POST /api/admin/stores/:slug/scrape`.
 *
 * Contains run diagnostics only — no per-product names or raw store data
 * are included in the response (raw names are debug-only, stored in
 * `store_stock.productNameRaw` and visible in structured logs).
 */
export class ScrapeResponseDto {
  /** Primary key of the `store_scrape_run` row created for this run. */
  runId!: number;

  /** Total products parsed from the store's listing pages. */
  productsFetched!: number;

  /** Products that resolved to a known `cardIdentifier`. */
  productsMatched!: number;

  /** Products that could not be matched (see structured logs for raw names). */
  productsUnmatched!: number;

  /** `store_stock` rows that were inserted or updated. */
  rowsUpserted!: number;

  /**
   * `store_stock` rows whose `quantity` was set to 0 because the product was
   * absent in this scrape run (reconciliation: zero-out, not delete).
   */
  rowsZeroed!: number;

  /**
   * Percentage of existing stock rows affected by this run (upserted + zeroed
   * relative to the prior row count). Null on first-run or paused_delta_guard
   * runs where no prior rows existed.
   */
  deltaPercent!: number | null;

  /** Wall-clock duration of the scrape run in milliseconds. */
  durationMs!: number;

  /**
   * True when this run bypassed a prior `paused_delta_guard` state via
   * `?force=true`. Preserved in the run row for post-incident audits.
   */
  forcedOverride!: boolean;
}

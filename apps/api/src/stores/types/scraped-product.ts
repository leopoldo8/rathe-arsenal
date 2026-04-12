/**
 * A single product record as parsed from a store's listing page.
 *
 * No database columns — this is a pure transfer object between
 * SbraubleScraperService and the ingestion layer (Unit 4).
 *
 * priceCents is null when the product has no public price
 * (e.g. "Sob consulta", "Indisponível"). Such rows are yielded
 * with quantity = 0 and are excluded from shopping lines by the
 * ingestion layer (requires priceCents IS NOT NULL AND quantity > 0).
 */
export interface IScrapedProduct {
  /** Raw product name as it appears on the listing page. */
  readonly rawName: string;

  /** Price in integer cents (BRL). Null when price is unavailable. */
  readonly priceCents: number | null;

  /** Current in-stock quantity. Zero when out of stock or price-unavailable. */
  readonly quantity: number;

  /** Absolute product detail URL (validated against store allow-list). */
  readonly productUrl: string;
}

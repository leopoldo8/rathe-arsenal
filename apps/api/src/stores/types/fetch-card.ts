/**
 * Input card record for a single variant fetch operation.
 * Provided by the caller (controller) after resolving store_stock rows.
 */
export interface IFetchCard {
  readonly cardIdentifier: string;
  readonly productUrl: string;
  /** The listing row's priceCents at the time the job is enqueued (snapshot). */
  readonly listingPriceCents: number | null;
  /** The listing row's quantity at the time the job is enqueued (snapshot). */
  readonly listingQuantity: number;
}

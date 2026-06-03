import { IScrapedVariant } from './types/scraped-variant';

export interface IDerivedStoreStock {
  readonly priceCents: number | null;
  readonly quantity: number;
}

/**
 * Representative store_stock from a card's detail-page variants:
 * cheapest in-stock price + summed in-stock quantity. Variants are already
 * filtered to quantity > 0 with available prices by the detail parser.
 */
export function deriveStoreStock(variants: readonly IScrapedVariant[]): IDerivedStoreStock {
  if (variants.length === 0) return { priceCents: null, quantity: 0 };
  const priceCents = Math.min(...variants.map((v) => v.priceCents));
  const quantity = variants.reduce((sum, v) => sum + v.quantity, 0);
  return { priceCents, quantity };
}

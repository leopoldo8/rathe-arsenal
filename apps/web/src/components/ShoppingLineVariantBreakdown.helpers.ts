/**
 * Pure helpers for ShoppingLineVariantBreakdown.
 *
 * Extracted into a sibling file so that `ShoppingLineVariantBreakdown.tsx`
 * remains component-only and Fast Refresh works without warnings.
 */

import type { IShoppingLineVariant } from '../api/shopping-line';
import { formatBrl } from '../utils/format-brl';

/**
 * Returns true when the finish string represents a foil finish.
 * 'Non-foil' is the only non-foil value; everything else is foil.
 */
export function isFoilFinish(finish: string): boolean {
  return finish.toLowerCase() !== 'non-foil';
}

/**
 * Formats a variant's price with condition annotation and optional foil suffix.
 * Example: "R$ 0,35 (NM)" or "R$ 0,80 (NM, Foil)"
 */
export function formatVariantPrice(variant: IShoppingLineVariant): string {
  const price = formatBrl(variant.priceCents);
  const foilSuffix = isFoilFinish(variant.finish) ? ', Foil' : '';
  return `${price} (${variant.condition}${foilSuffix})`;
}

import type { IShoppingLineLine, IShoppingLineResponse } from '../../api/shopping-line';
import { validateProductUrl } from '../StoreProductLink.helpers';

export type TRowStore =
  | { readonly kind: 'none' }
  | { readonly kind: 'unavailable'; readonly verifiedZero: boolean }
  | {
      readonly kind: 'available';
      readonly line: IShoppingLineLine;
      /** Null when the store gave no usable link; the row then shows no Buy control. */
      readonly buyUrl: string | null;
    };

/**
 * What the store can do for one missing card. Without populated store data
 * nothing is known, so no claim is made either way.
 */
export function resolveRowStore(
  data: IShoppingLineResponse | null,
  cardIdentifier: string,
): TRowStore {
  if (data === null || data.kind !== 'populated') return { kind: 'none' };
  const line = data.lines.find((candidate) => candidate.cardIdentifier === cardIdentifier);
  if (line === undefined || line.quantityAvailable === 0) {
    return { kind: 'unavailable', verifiedZero: line?.verificationStatus === 'verified_zero' };
  }
  const buyUrl = validateProductUrl(line.productUrl, data.storeHostname) ? line.productUrl : null;
  return { kind: 'available', line, buyUrl };
}

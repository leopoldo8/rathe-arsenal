import { IPriceSuggestion } from '../lists/dtos/card-list.dto';
import { ICardPrinting } from '../lists/printing-key';
import { printingSubType } from './price-sub-type';

export interface IPriceSnapshot {
  readonly marketPriceCents: number | null;
  readonly midPriceCents: number | null;
  readonly fetchedAt: Date;
}

export type TPriceIndex = ReadonlyMap<string, IPriceSnapshot>;

export const MIN_SUGGESTION_CENTS = 100;
const CENTS_PER_REAL = 100;

export function priceIndexKey(productId: string, subType: string): string {
  return `${productId}:${subType}`;
}

export function priceKeysOf(printing: ICardPrinting): string | null {
  if (printing.productId === null) return null;
  const subType = printingSubType(printing.foiling, printing.edition);
  return subType === null ? null : priceIndexKey(printing.productId, subType);
}

/** USD cents times the multiplier read as BRL cents, rounded to whole reais and never below R$ 1. */
export function toSuggestedCents(usdCents: number, multiplier: number): number {
  return Math.max(MIN_SUGGESTION_CENTS, Math.round((usdCents * multiplier) / CENTS_PER_REAL) * CENTS_PER_REAL);
}

interface IPricedPrinting {
  readonly printing: ICardPrinting;
  readonly snapshot: IPriceSnapshot;
}

function cheapest(pool: readonly IPricedPrinting[], field: 'marketPriceCents' | 'midPriceCents'): IPricedPrinting | undefined {
  return pool.reduce<IPricedPrinting | undefined>(
    (best, candidate) => (best === undefined || (candidate.snapshot[field] ?? 0) < (best.snapshot[field] ?? 0) ? candidate : best),
    undefined,
  );
}

function preferNonFoil(pool: readonly IPricedPrinting[]): readonly IPricedPrinting[] {
  const nonFoil = pool.filter((entry) => entry.printing.foiling === null);
  return nonFoil.length > 0 ? nonFoil : pool;
}

function buildSuggestion(entry: IPricedPrinting, usdCents: number, multiplier: number, approximate: boolean): IPriceSuggestion {
  return {
    cents: toSuggestedCents(usdCents, multiplier),
    approximate,
    fetchedAt: entry.snapshot.fetchedAt.toISOString(),
    printing: entry.printing.key,
  };
}

/**
 * With a chosen printing, only that printing is priced. Without one, the cheapest non-foil printing that has a
 * market price, else the cheapest printing of any finish; mid price counts only when no printing has a market price.
 */
export function suggestPrice(
  printings: readonly ICardPrinting[],
  chosenKey: string | null,
  prices: TPriceIndex,
  multiplier: number,
): IPriceSuggestion | null {
  const priced = printings
    .filter((printing) => chosenKey === null || printing.key === chosenKey)
    .flatMap((printing) => {
      const key = priceKeysOf(printing);
      const snapshot = key === null ? undefined : prices.get(key);
      return snapshot ? [{ printing, snapshot }] : [];
    });

  const withMarket = priced.filter((entry) => entry.snapshot.marketPriceCents !== null);
  if (withMarket.length > 0) {
    const best = cheapest(preferNonFoil(withMarket), 'marketPriceCents');
    return best ? buildSuggestion(best, best.snapshot.marketPriceCents ?? 0, multiplier, false) : null;
  }

  const withMid = priced.filter((entry) => entry.snapshot.midPriceCents !== null);
  const best = cheapest(preferNonFoil(withMid), 'midPriceCents');
  return best ? buildSuggestion(best, best.snapshot.midPriceCents ?? 0, multiplier, true) : null;
}

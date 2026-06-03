import { deriveStoreStock } from '../store-stock-derivation';
import { IScrapedVariant } from '../types/scraped-variant';

const v = (priceCents: number, quantity: number): IScrapedVariant => ({
  edition: 'PEN', condition: 'NM', finish: 'non-foil', priceCents, quantity,
});

describe('deriveStoreStock', () => {
  it('returns cheapest in-stock price and summed quantity', () => {
    const r = deriveStoreStock([v(300, 1), v(100, 9), v(250, 2)]);
    expect(r).toEqual({ priceCents: 100, quantity: 12 });
  });

  it('returns null price and zero quantity when no variants', () => {
    expect(deriveStoreStock([])).toEqual({ priceCents: null, quantity: 0 });
  });
});

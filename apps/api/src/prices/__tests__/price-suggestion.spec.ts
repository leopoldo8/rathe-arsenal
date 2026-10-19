import { ICardPrinting } from '../../lists/printing-key';
import { IPriceSnapshot, priceIndexKey, suggestPrice, toSuggestedCents } from '../price-suggestion';

const FETCHED_AT = new Date('2026-10-18T20:30:00Z');

function printing(key: string, foiling: string | null, productId: string | null, edition: string | null = null): ICardPrinting {
  return { key, label: key, identifier: key.split('.')[0] as string, set: 'Set', foiling, edition, productId };
}

function index(entries: [string, string, number | null, number | null][]): Map<string, IPriceSnapshot> {
  return new Map(
    entries.map(([productId, subType, market, mid]) => [
      priceIndexKey(productId, subType),
      { marketPriceCents: market, midPriceCents: mid, fetchedAt: FETCHED_AT },
    ]),
  );
}

describe('toSuggestedCents', () => {
  it('reads USD cents times the multiplier as BRL and rounds to whole reais', () => {
    expect(toSuggestedCents(2541, 7)).toBe(17800);
    expect(toSuggestedCents(200, 7)).toBe(1400);
    expect(toSuggestedCents(150, 6.5)).toBe(1000);
  });

  it('rounds halves up and never goes below one real', () => {
    expect(toSuggestedCents(50, 7)).toBe(400);
    expect(toSuggestedCents(6, 7)).toBe(100);
  });
});

describe('suggestPrice', () => {
  const normal = printing('AAA001', null, '1');
  const foil = printing('AAA001.RF', 'Rainbow', '1');
  const firstNormal = printing('AAA001.1E', null, '2', 'First');
  const noProduct = printing('AAA002', null, null);

  it('prices a chosen printing from its own row only', () => {
    const prices = index([['1', 'Normal', 200, 250], ['1', 'Rainbow Foil', 900, 950]]);
    expect(suggestPrice([normal, foil], 'AAA001.RF', prices, 7)).toEqual({
      cents: 6300,
      approximate: false,
      fetchedAt: FETCHED_AT.toISOString(),
      printing: 'AAA001.RF',
    });
  });

  it('marks a chosen printing approximate when only mid price exists', () => {
    const prices = index([['1', 'Normal', null, 300]]);
    expect(suggestPrice([normal], 'AAA001', prices, 7)).toMatchObject({ cents: 2100, approximate: true });
  });

  it('gives no suggestion for a chosen printing without a row, without a product id, or without prices', () => {
    expect(suggestPrice([normal], 'AAA001', index([]), 7)).toBeNull();
    expect(suggestPrice([noProduct], 'AAA002', index([['1', 'Normal', 100, 100]]), 7)).toBeNull();
    expect(suggestPrice([normal], 'AAA001', index([['1', 'Normal', null, null]]), 7)).toBeNull();
  });

  it('without a chosen printing picks the cheapest non-foil printing with a market price', () => {
    const prices = index([['1', 'Normal', 400, 400], ['1', 'Rainbow Foil', 100, 100], ['2', '1st Edition Normal', 250, 250]]);
    expect(suggestPrice([normal, foil, firstNormal], null, prices, 7)).toMatchObject({ printing: 'AAA001.1E', cents: 1800 });
  });

  it('falls back to the cheapest printing of any finish when the card has no priced non-foil', () => {
    const prices = index([['1', 'Rainbow Foil', 900, 900], ['1', 'Cold Foil', 500, 500]]);
    const cold = printing('AAA001.CF', 'Cold', '1');
    expect(suggestPrice([foil, cold], null, prices, 7)).toMatchObject({ printing: 'AAA001.CF', approximate: false });
  });

  it('uses mid price, approximate, only when no printing has a market price', () => {
    const onlyMid = index([['1', 'Normal', null, 300], ['2', '1st Edition Normal', null, 200]]);
    expect(suggestPrice([normal, firstNormal], null, onlyMid, 7)).toMatchObject({ printing: 'AAA001.1E', approximate: true });

    const marketElsewhere = index([['1', 'Normal', null, 10], ['1', 'Rainbow Foil', 800, 800]]);
    expect(suggestPrice([normal, foil], null, marketElsewhere, 7)).toMatchObject({ printing: 'AAA001.RF', approximate: false });
  });

  it('never prices an Alpha printing', () => {
    const alpha = printing('AAA001.AE', null, '1', 'Alpha');
    expect(suggestPrice([alpha], null, index([['1', 'Normal', 100, 100]]), 7)).toBeNull();
  });
});

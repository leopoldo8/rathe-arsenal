import { IShoppingLine, IShoppingLinePopulated } from '../../stores/dtos/shopping-line.response.dto';
import { priceReport } from '../price-report';

function line(cardIdentifier: string, quantityNeeded: number, quantityAvailable: number, unitPriceCents: number | null): IShoppingLine {
  return {
    cardIdentifier,
    cardName: cardIdentifier,
    pitch: 1,
    quantityNeeded,
    quantityAvailable,
    unitPriceCents,
    productUrl: `https://www.cupuladt.com.br/p/${cardIdentifier}`,
    lastFetchedAt: '2026-10-18T10:00:00.000Z',
    hasVariantData: false,
    dataSource: 'listing',
    lineCostCents: quantityAvailable * (unitPriceCents ?? 0),
  };
}

const STORE: IShoppingLinePopulated = {
  kind: 'populated',
  storeName: 'Cúpula DT',
  storeSlug: 'cupula-dt',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 2500,
  availableCardCount: 1,
  unavailableCardCount: 1,
  lastFetchedAt: '2026-10-18T10:00:00.000Z',
  lines: [line('lace-with-bloodrot-red', 2, 2, 1250), line('boltn-boots', 1, 0, null)],
  upgradeCandidates: [],
  isEstimated: true,
};

describe('priceReport', () => {
  const market = new Map([['lace-with-bloodrot-red', { usdCents: 35, approximate: false, printing: 'SEA Regular', fetchedAt: '2026-10-17T00:00:00.000Z' }]]);

  it("gives each card's store price in reais with stock and link, its TCGplayer price in dollars, and the totals", () => {
    const report = priceReport({
      wanted: [
        { cardIdentifier: 'lace-with-bloodrot-red', quantity: 2 },
        { cardIdentifier: 'boltn-boots', quantity: 1 },
      ],
      store: STORE,
      market,
    });

    expect(report).toEqual({
      store: { name: 'Cúpula DT', currency: 'BRL', fetchedAt: '2026-10-18T10:00:00.000Z', totalCents: 2500, cardsOutOfStock: 1 },
      tcgplayer: { currency: 'USD', totalCents: 70, cardsWithoutPrice: 1 },
      cards: [
        {
          cardIdentifier: 'lace-with-bloodrot-red',
          name: 'Lace with Bloodrot',
          quantity: 2,
          store: { unitPriceCents: 1250, available: 2, lineCents: 2500, productUrl: 'https://www.cupuladt.com.br/p/lace-with-bloodrot-red' },
          tcgplayer: { unitPriceCents: 35, lineCents: 70, approximate: false, printing: 'SEA Regular', fetchedAt: '2026-10-17T00:00:00.000Z' },
        },
        { cardIdentifier: 'boltn-boots', name: "Bolt'n Boots", quantity: 1, store: null, tcgplayer: null },
      ],
    });
  });

  it('says why the store has no prices when the stock was never scraped or the lookup failed', () => {
    const wanted = [{ cardIdentifier: 'boltn-boots', quantity: 1 }];

    expect(priceReport({ wanted, store: { kind: 'unscraped' }, market: new Map() }).store).toEqual({ unavailable: 'unscraped' });
    expect(priceReport({ wanted, store: { kind: 'error', reason: 'store_missing' }, market: new Map() }).store).toEqual({ unavailable: 'error' });
    expect(priceReport({ wanted, store: null, market: new Map() }).store).toEqual({ unavailable: 'error' });
  });
});

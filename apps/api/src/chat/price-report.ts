import { IMarketPrice } from '../prices/price-suggestion.service';
import { IShoppingLineResponse } from '../stores/dtos/shopping-line.response.dto';
import { findCard } from './deck-rows';

export interface IWantedCard {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

interface IStorePrice {
  readonly unitPriceCents: number;
  readonly available: number;
  readonly lineCents: number;
  readonly productUrl: string;
}

interface ITcgplayerPrice {
  readonly unitPriceCents: number;
  readonly lineCents: number;
  readonly approximate: boolean;
  readonly printing: string;
  readonly fetchedAt: string;
}

export interface IPriceReport {
  readonly store:
    | { readonly name: string; readonly currency: 'BRL'; readonly fetchedAt: string; readonly totalCents: number; readonly cardsOutOfStock: number }
    | { readonly unavailable: 'unscraped' | 'error' };
  readonly tcgplayer: { readonly currency: 'USD'; readonly totalCents: number; readonly cardsWithoutPrice: number };
  readonly cards: readonly {
    readonly cardIdentifier: string;
    readonly name: string;
    readonly quantity: number;
    readonly store: IStorePrice | null;
    readonly tcgplayer: ITcgplayerPrice | null;
  }[];
}

export function priceReport(input: {
  readonly wanted: readonly IWantedCard[];
  readonly store: IShoppingLineResponse | null;
  readonly market: ReadonlyMap<string, IMarketPrice>;
}): IPriceReport {
  const populated = input.store?.kind === 'populated' ? input.store : null;
  const cards = input.wanted.map(({ cardIdentifier, quantity }) => {
    const line = populated?.lines.find((entry) => entry.cardIdentifier === cardIdentifier);
    const market = input.market.get(cardIdentifier);
    return {
      cardIdentifier,
      name: findCard(cardIdentifier)?.name ?? cardIdentifier,
      quantity,
      store:
        line && line.unitPriceCents !== null && line.quantityAvailable > 0
          ? { unitPriceCents: line.unitPriceCents, available: line.quantityAvailable, lineCents: line.lineCostCents, productUrl: line.productUrl }
          : null,
      tcgplayer: market
        ? { unitPriceCents: market.usdCents, lineCents: market.usdCents * quantity, approximate: market.approximate, printing: market.printing, fetchedAt: market.fetchedAt }
        : null,
    };
  });
  return {
    store: populated
      ? {
          name: populated.storeName,
          currency: 'BRL',
          fetchedAt: populated.lastFetchedAt,
          totalCents: cards.reduce((sum, card) => sum + (card.store?.lineCents ?? 0), 0),
          cardsOutOfStock: cards.filter((card) => card.store === null).length,
        }
      : { unavailable: input.store?.kind === 'unscraped' ? 'unscraped' : 'error' },
    tcgplayer: {
      currency: 'USD',
      totalCents: cards.reduce((sum, card) => sum + (card.tcgplayer?.lineCents ?? 0), 0),
      cardsWithoutPrice: cards.filter((card) => card.tcgplayer === null).length,
    },
    cards,
  };
}

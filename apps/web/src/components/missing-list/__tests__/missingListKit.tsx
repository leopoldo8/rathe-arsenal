import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IMissingLine, IMissingListResponse, IMissingSummary } from '../../../api/missing-list';

export function line(overrides: Partial<IMissingLine> = {}): IMissingLine {
  return {
    cardIdentifier: 'pack-hunt-red',
    slot: 'mainboard',
    name: 'Pack Hunt',
    pitch: 1,
    imageUrl: null,
    deckNeeded: 3,
    inventoryNeeded: 0,
    deckQuantity: 3,
    ownedTotal: 0,
    ownedElsewhere: 0,
    state: 'priced',
    unitPriceCents: 20,
    lineCents: 60,
    availableCopies: 3,
    foilOnly: false,
    promoOnly: false,
    productUrl: 'https://store.test/pack-hunt',
    searchUrl: null,
    standIn: null,
    ...overrides,
  };
}

export function summary(overrides: Partial<IMissingSummary> = {}): IMissingSummary {
  return {
    totalCopies: 66,
    buyCopies: 43,
    buyCents: 45228,
    lacksCopies: 14,
    notOnSiteCopies: 2,
    ownedCopies: 5,
    standInCopies: 2,
    lookingUp: 0,
    noPrice: 0,
    availabilityCheckedAt: '2026-10-19T12:00:00.000Z',
    priceValidDays: 30,
    ...overrides,
  };
}

export function response(lines: readonly IMissingLine[], overrides: Partial<IMissingSummary> = {}): IMissingListResponse {
  return { summary: summary(overrides), lines };
}

export const SEARCH_BASE = 'https://store.test/?view=ecom/itens&busca=';

export function Providers({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

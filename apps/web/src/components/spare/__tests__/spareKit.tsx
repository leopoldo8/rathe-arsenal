import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IDeckUse, ISpareResponse, ISpareRow, ISpareWhy } from '../../../api/spare';

export function Providers({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function row(overrides: Partial<ISpareRow> & Pick<ISpareRow, 'cardIdentifier' | 'name' | 'spare'>): ISpareRow {
  return {
    pitch: 1,
    imageUrl: null,
    printingCode: '',
    edition: '',
    finish: '',
    condition: '',
    setName: null,
    foilFinishes: [],
    suggestedCents: null,
    storeCents: null,
    ...overrides,
  };
}

export const DUDA_ROWS: readonly ISpareRow[] = [
  row({ cardIdentifier: 'enlightened-strike-red', name: 'Enlightened Strike', spare: 1, finish: 'rainbow', condition: 'NM', foilFinishes: ['rainbow'], suggestedCents: 6000 }),
  row({ cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', spare: 2, printingCode: 'HP1001', condition: 'NM', setName: 'History Pack 1', suggestedCents: 4500 }),
  row({ cardIdentifier: 'enlightened-strike-red', name: 'Enlightened Strike', spare: 1, foilFinishes: ['rainbow'], suggestedCents: 1200, storeCents: 800 }),
  row({ cardIdentifier: 'snatch-red', name: 'Snatch', spare: 2, foilFinishes: ['rainbow'], suggestedCents: 600, storeCents: 150 }),
  row({ cardIdentifier: 'pummel-red', name: 'Pummel', spare: 3, foilFinishes: ['rainbow'], suggestedCents: 400, storeCents: 90 }),
  row({ cardIdentifier: 'head-jab-red', name: 'Head Jab', spare: 4, suggestedCents: 200, storeCents: 50 }),
  row({ cardIdentifier: 'pack-hunt-blue', name: 'Pack Hunt', pitch: 3, spare: 1, suggestedCents: 200, storeCents: 30 }),
  row({ cardIdentifier: 'wounding-blow-red', name: 'Wounding Blow', spare: 6, suggestedCents: 100, storeCents: 20 }),
];

export const KAYO: IDeckUse = { deckId: 1, deckName: 'Kayo CC', format: 'Classic Constructed', deck: 3, inventory: 0, use: 3 };
export const RHINAR_CC: IDeckUse = { deckId: 2, deckName: 'Rhinar CC', format: 'Classic Constructed', deck: 2, inventory: 0, use: 2 };
export const RHINAR_SA: IDeckUse = { deckId: 3, deckName: 'Rhinar SA', format: 'Silver Age', deck: 2, inventory: 0, use: 2 };

export function why(overrides: Partial<ISpareWhy> = {}): ISpareWhy {
  return {
    owned: 6,
    held: 5,
    spare: 1,
    holders: [KAYO, RHINAR_CC, RHINAR_SA],
    notHolding: [{ deckId: 4, deckName: 'Dash ideia', status: 'idea' }],
    ...overrides,
  };
}

export function response(overrides: Partial<ISpareResponse> = {}): ISpareResponse {
  return {
    needsRule: false,
    rule: 'within_format',
    counts: { within_format: 20, any_deck: 24, per_deck: 19 },
    totalSpare: 20,
    rows: DUDA_ROWS,
    why: { 'pack-hunt-blue': why() },
    ideaDecks: [{ deckId: 4, deckName: 'Dash ideia', cardIdentifier: 'head-jab-red', name: 'Head Jab', pitch: 1, use: 3 }],
    ...overrides,
  };
}

import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../../lib/api-client';
import type {
  IChatConversation,
  IChatConversationSummary,
  IChatMessage,
  IChatUsage,
  IDeckProposal,
  ISwapCardFacts,
  ISwapProposal,
  TChatMessageStatus,
} from '../../../api/chat';
import type { ITrackedDeckListItem } from '../../../api/decks';
import type { IAlternativeImageUrl } from '../../../api/replacements';

export { mockApiFetch, mockNavigate, routerMock, navigatedTo } from './chat-test-mocks';
import { mockApiFetch } from './chat-test-mocks';

type THandler = (body: unknown) => unknown;

/** Routes `mockApiFetch` by `METHOD /path`; an unrouted call fails the test loudly. */
export function serveApi(routes: Record<string, THandler>): void {
  mockApiFetch.mockImplementation(async (path: string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unrouted ${key}`);
    return handler(typeof init.body === 'string' ? JSON.parse(init.body) : undefined);
  });
}

export function callsTo(key: string): unknown[] {
  return mockApiFetch.mock.calls
    .filter(([path, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${path}` === key)
    .map(([, init]) => {
      const body = (init as RequestInit | undefined)?.body;
      return typeof body === 'string' ? JSON.parse(body) : undefined;
    });
}

export function apiError(status: number, code?: string, details?: Record<string, unknown>): ApiError {
  return new ApiError(status, code ? JSON.stringify({ code, message: code, ...(details ? { details } : {}) }) : 'error');
}

export function renderWithClient(ui: React.ReactElement): RenderResult & { client: QueryClient } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...result, client };
}

export function deck(overrides: Partial<ITrackedDeckListItem> & { id: number; name: string; hero: string }): ITrackedDeckListItem {
  return {
    fabraryUlid: null,
    format: 'Classic Constructed',
    trackedAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    latestSnapshot: null,
    status: 'building',
    tags: [],
    ...overrides,
  } as ITrackedDeckListItem;
}

export function decksResponse(decks: ITrackedDeckListItem[]) {
  return { trackedDecks: decks, collectionCardCount: 0, totalMissingCopies: 0 };
}

export const NOT_AT_CAP: IChatUsage = { spentUsd: 0.4, budgetUsd: 5, resetsAt: '2026-11-01T00:00:00.000Z' };
export const AT_CAP: IChatUsage = { spentUsd: 5, budgetUsd: 5, resetsAt: '2026-11-01T00:00:00.000Z' };

export function message(overrides: Partial<IChatMessage> & { id: string; role: 'user' | 'assistant' }): IChatMessage {
  return {
    status: 'done' as TChatMessageStatus,
    text: null,
    error: null,
    proposals: [],
    createdAt: '2026-10-11T10:00:00.000Z',
    ...overrides,
  };
}

export function conversation(overrides: Partial<IChatConversation> = {}): IChatConversation {
  return { id: 'c-1', title: 'Katsu nos torneios', trackedDeckId: null, updatedAt: '2026-10-11T10:00:00.000Z', messages: [], ...overrides };
}

export function summary(overrides: Partial<IChatConversationSummary> & { id: string }): IChatConversationSummary {
  return { title: 'Conversa', trackedDeckId: null, updatedAt: '2026-10-11T10:00:00.000Z', ...overrides };
}

const DECK_CARDS = [
  { cardIdentifier: 'emissary-of-tides-red', name: 'Emissary of Tides', pitch: 3, quantity: 3, slot: 'mainboard', ownedQuantity: 3 },
  { cardIdentifier: 'flex-red', name: 'Flex', pitch: 1, quantity: 3, slot: 'mainboard', ownedQuantity: 3 },
  { cardIdentifier: 'lunging-press-yellow', name: 'Lunging Press', pitch: 2, quantity: 2, slot: 'mainboard', ownedQuantity: 1 },
  { cardIdentifier: 'springboard-somersault-blue', name: 'Springboard Somersault', pitch: 3, quantity: 3, slot: 'mainboard', ownedQuantity: 0 },
  { cardIdentifier: 'whirling-mist-blossom-yellow', name: 'Whirling Mist Blossom', pitch: 2, quantity: 49, slot: 'mainboard', ownedQuantity: 34 },
];

export function deckProposal(overrides: Partial<IDeckProposal> = {}): IDeckProposal {
  return {
    id: 'p-1',
    kind: 'deck',
    status: 'pending',
    reason: 'Aproveita o que você já tem.',
    ownedCount: 41,
    missingCount: 19,
    trackedDeckId: null,
    cardReplacementId: null,
    replacementStatus: null,
    payload: { name: 'Katsu Tempo', heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' },
    display: { heroName: 'Katsu, the Wanderer', cards: DECK_CARDS },
    ...overrides,
  };
}

function cardImage(code: string): IAlternativeImageUrl {
  const small = `https://cards.example/small/${code}.webp`;
  const large = `https://cards.example/large/${code}.webp`;
  return { small, large, sources: [{ small, large }] };
}

export function swapFacts(overrides: Partial<ISwapCardFacts> = {}): ISwapCardFacts {
  return { types: ['Action'], subtypes: ['Attack'], cost: 0, power: 4, defense: 3, pitch: 1, ...overrides };
}

export function swapProposal(overrides: Partial<ISwapProposal> = {}): ISwapProposal {
  return {
    id: 'p-2',
    kind: 'swap',
    status: 'pending',
    reason: 'Mais barata e você já tem.',
    ownedCount: 1,
    missingCount: 0,
    trackedDeckId: 7,
    cardReplacementId: null,
    replacementStatus: null,
    payload: { trackedDeckId: 7, slot: 'mainboard', quantity: 1, side: 'inventory', missingBefore: 7, missingAfter: 8 },
    display: {
      original: { cardIdentifier: 'flex-red', name: 'Flex', pitch: 1, imageUrl: cardImage('FLEX'), copiesInDeck: 2, copiesLeft: 2, facts: swapFacts() },
      replacement: {
        cardIdentifier: 'emissary-of-tides-red',
        name: 'Emissary of Tides',
        pitch: 3,
        imageUrl: cardImage('EMISSARY'),
        freeCopies: 3,
        storePriceCents: null,
        facts: swapFacts({ pitch: 3 }),
      },
    },
    ...overrides,
  };
}

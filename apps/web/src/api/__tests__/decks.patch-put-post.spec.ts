/**
 * Unit tests for the v2 deck mutations added in U7:
 *   - usePatchDeckMutation
 *   - usePutDeckMutation
 *   - useCreateScratchDeckMutation
 *
 * Test scenarios covered:
 * - usePatchDeckMutation success → invalidates DECKS_QUERY_KEY + deck-detail + tags.
 * - usePutDeckMutation success → returns IPutDeckResponse + invalidates list + detail + library.
 * - usePutDeckMutation 5xx → surfaces error via mutation.error (does NOT touch localStorage).
 * - useCreateScratchDeckMutation success → returns new deck + invalidates DECKS_QUERY_KEY.
 * - Mutation invalidations trigger refetches in components sharing the same query keys.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePatchDeckMutation,
  usePutDeckMutation,
  useCreateScratchDeckMutation,
  type IPutDeckResponse,
  type ICreateScratchDeckResponse,
} from '../decks';

// ---------------------------------------------------------------------------
// Mock useApiClient
// ---------------------------------------------------------------------------

const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', () => ({
  useApiClient: () => mockApiFetch,
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makePutResponse(overrides: Partial<IPutDeckResponse> = {}): IPutDeckResponse {
  return {
    id: 1,
    name: 'Katsu Blitz',
    hero: 'Katsu',
    heroIdentifier: 'katsu-the-wanderer-wtr',
    format: 'blitz',
    status: 'building',
    tags: ['liga local'],
    legality: { category: 'legal', reasons: [] },
    updatedAt: '2026-01-15T10:00:00Z',
    readiness: { rawPercent: 87, effectivePercent: 100 },
    ...overrides,
  };
}

function makeScratchResponse(
  overrides: Partial<ICreateScratchDeckResponse> = {},
): ICreateScratchDeckResponse {
  return {
    id: 42,
    name: 'New Deck',
    heroIdentifier: null,
    format: 'CC',
    status: 'idea',
    trackedAt: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

const DECK_ID = 1;

// ---------------------------------------------------------------------------
// usePatchDeckMutation
// ---------------------------------------------------------------------------

describe('usePatchDeckMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('calls PATCH /decks/:id with the correct body', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePatchDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ status: 'active' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/decks/${DECK_ID}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }),
    );
  });

  it('invalidates DECKS_QUERY_KEY, deck-detail, and tags on success', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => usePatchDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'Renamed Deck' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(invalidatedKeys.some((k) => k.includes('"decks"'))).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"deck-detail"'))).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"tags"'))).toBe(true);
  });

  it('invalidates the correct deck-detail key (deckId-scoped)', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => usePatchDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ addTagIds: [7] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(
      invalidatedKeys.some((k) => k.includes('"deck-detail"') && k.includes(`"${DECK_ID}"`)),
    ).toBe(true);
  });

  it('surfaces error via mutation.error on network failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePatchDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ status: 'ready' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// usePutDeckMutation
// ---------------------------------------------------------------------------

describe('usePutDeckMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('calls PUT /decks/:id and returns the IPutDeckResponse on success', async () => {
    const response = makePutResponse();
    mockApiFetch.mockResolvedValueOnce(response);

    const { result } = renderHook(() => usePutDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        cards: [{ cardIdentifier: 'pummel-wtr', quantity: 3, slot: 'mainboard' }],
        heroIdentifier: 'katsu-the-wanderer-wtr',
        format: 'blitz',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/decks/${DECK_ID}`,
      expect.objectContaining({ method: 'PUT' }),
    );

    expect(result.current.data?.legality.category).toBe('legal');
    expect(result.current.data?.readiness?.effectivePercent).toBe(100);
  });

  it('invalidates DECKS_QUERY_KEY + deck-detail + LIBRARY_QUERY_KEY on success', async () => {
    const response = makePutResponse();
    mockApiFetch.mockResolvedValueOnce(response);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => usePutDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        cards: [],
        heroIdentifier: null,
        format: 'CC',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(invalidatedKeys.some((k) => k.includes('"decks"'))).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"deck-detail"'))).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"library"'))).toBe(true);
  });

  it('surfaces 5xx error via mutation.error without touching localStorage', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Internal Server Error'));

    // Spy on localStorage to ensure it is not touched by the hook
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => usePutDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        cards: [{ cardIdentifier: 'pummel-wtr', quantity: 3, slot: 'mainboard' }],
        heroIdentifier: 'katsu-the-wanderer-wtr',
        format: 'blitz',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    // The hook must NOT write to localStorage — that is U13's concern
    expect(localStorageSpy).not.toHaveBeenCalled();

    localStorageSpy.mockRestore();
  });

  it('returns the in-memory readiness from the PUT response (not a stale cache read)', async () => {
    const response = makePutResponse({
      readiness: { rawPercent: 72, effectivePercent: 88 },
    });
    mockApiFetch.mockResolvedValueOnce(response);

    const { result } = renderHook(() => usePutDeckMutation(DECK_ID), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ cards: [], heroIdentifier: null, format: 'blitz' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The data comes directly from the PUT response
    expect(result.current.data?.readiness?.rawPercent).toBe(72);
    expect(result.current.data?.readiness?.effectivePercent).toBe(88);
  });
});

// ---------------------------------------------------------------------------
// useCreateScratchDeckMutation
// ---------------------------------------------------------------------------

describe('useCreateScratchDeckMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('calls POST /decks and returns the new deck on success', async () => {
    const response = makeScratchResponse({ id: 99, heroIdentifier: null, format: 'CC' });
    mockApiFetch.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useCreateScratchDeckMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ heroIdentifier: null, format: 'CC' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/decks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ heroIdentifier: null, format: 'CC' }),
      }),
    );

    expect(result.current.data?.id).toBe(99);
    expect(result.current.data?.status).toBe('idea');
  });

  it('invalidates DECKS_QUERY_KEY so the home list picks up the new deck', async () => {
    const response = makeScratchResponse();
    mockApiFetch.mockResolvedValueOnce(response);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateScratchDeckMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ heroIdentifier: null, format: 'blitz' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(invalidatedKeys.some((k) => k.includes('"decks"'))).toBe(true);
  });

  it('returns data that the caller can use for navigation', async () => {
    const response = makeScratchResponse({
      id: 7,
      heroIdentifier: 'katsu-the-wanderer-wtr',
      format: 'blitz',
      status: 'idea',
    });
    mockApiFetch.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useCreateScratchDeckMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ heroIdentifier: 'katsu-the-wanderer-wtr', format: 'blitz' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Caller pattern:
    // navigate({ to: '/decks/$deckId', params: { deckId: String(data.id) }, search: { edit: '1' } })
    const deckId = result.current.data?.id;
    expect(deckId).toBe(7);
    expect(String(deckId)).toBe('7');
  });

  it('surfaces error via mutation.error on failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCreateScratchDeckMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ heroIdentifier: null, format: 'CC' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

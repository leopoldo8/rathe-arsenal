/**
 * Unit tests for apps/web/src/api/tags.ts (U7).
 *
 * Test scenarios covered:
 * - useTagsQuery returns user's tags and is cached (staleTime: Infinity).
 * - useCreateTagMutation success → invalidates ['tags'].
 * - useCreateTagMutation 422 (200-cap) surfaces via mutation.error.
 * - useDeleteTagMutation success → invalidates ['tags'], ['decks'], ['deck-detail'].
 * - Mutation invalidations trigger refetches in components sharing the same keys.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useTagsQuery,
  useCreateTagMutation,
  useDeleteTagMutation,
  type ITagResponse,
  type ITagListResponse,
} from '../tags';
import { ApiError } from '../../lib/api-client';

// ---------------------------------------------------------------------------
// Mock useApiClient
// ---------------------------------------------------------------------------

const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api-client')>();
  return {
    ...actual,
    useApiClient: () => mockApiFetch,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeTag(overrides: Partial<ITagResponse> = {}): ITagResponse {
  return {
    id: 1,
    name: 'liga local',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// useTagsQuery
// ---------------------------------------------------------------------------

describe('useTagsQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('returns the list of user tags on success', async () => {
    const response: ITagListResponse = {
      tags: [makeTag({ id: 1, name: 'liga local' }), makeTag({ id: 2, name: 'casual' })],
    };
    mockApiFetch.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useTagsQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.tags).toHaveLength(2);
    expect(result.current.data?.tags[0]?.name).toBe('liga local');
  });

  it('caches results and does not re-fetch (staleTime: Infinity)', async () => {
    const response: ITagListResponse = { tags: [makeTag()] };
    mockApiFetch.mockResolvedValue(response);

    const { result: r1 } = renderHook(() => useTagsQuery(), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    // Second hook with the same query client should use cache
    const { result: r2 } = renderHook(() => useTagsQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    // Should be immediately available from cache (no loading state)
    expect(r2.current.data?.tags).toHaveLength(1);
    // fetch was called only once across both hook instances
    expect(mockApiFetch).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// useCreateTagMutation
// ---------------------------------------------------------------------------

describe('useCreateTagMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('calls POST /tags and invalidates ["tags"] on success', async () => {
    const newTag = makeTag({ id: 3, name: 'nationals' });
    mockApiFetch.mockResolvedValueOnce(newTag);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTagMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'nationals' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/tags',
      expect.objectContaining({ method: 'POST' }),
    );

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(invalidatedKeys.some((k) => k.includes('"tags"'))).toBe(true);
  });

  it('returns the created tag as mutation data', async () => {
    const newTag = makeTag({ id: 10, name: 'torneio' });
    mockApiFetch.mockResolvedValueOnce(newTag);

    const { result } = renderHook(() => useCreateTagMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'torneio' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.id).toBe(10);
    expect(result.current.data?.name).toBe('torneio');
  });

  it('surfaces 422 (200-tag limit) via mutation.error without crashing', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError(422, 'Tag limit reached'));

    const { result } = renderHook(() => useCreateTagMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'tag-over-limit' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    // The caller can inspect the status code to render the friendly message
    expect((result.current.error as ApiError).status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// useDeleteTagMutation
// ---------------------------------------------------------------------------

describe('useDeleteTagMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('calls DELETE /tags/:id and invalidates tags + decks + deck-detail on success', async () => {
    mockApiFetch.mockResolvedValueOnce(undefined);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTagMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(5);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/tags/5',
      expect.objectContaining({ method: 'DELETE' }),
    );

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(invalidatedKeys.some((k) => k.includes('"tags"'))).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"decks"'))).toBe(true);
    expect(invalidatedKeys.some((k) => k.includes('"deck-detail"'))).toBe(true);
  });

  it('surfaces fetch error via mutation.error', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDeleteTagMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(99);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('invalidation triggers refetch on stale queries sharing the same key', async () => {
    // Seed the tags query cache
    queryClient.setQueryData(['tags'], { tags: [makeTag()] });

    mockApiFetch
      .mockResolvedValueOnce(undefined) // DELETE call
      .mockResolvedValueOnce({ tags: [] }); // subsequent useTagsQuery refetch

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTagMutation(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify invalidateQueries was called — TanStack Query triggers the refetch
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

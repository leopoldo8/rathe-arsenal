/**
 * Unit tests for the heroes query added to catalog.ts in U7.
 *
 * Test scenarios covered:
 * - useHeroesQuery returns the slim hero list with the correct shape.
 * - useHeroesQuery is cached indefinitely (staleTime: Infinity — hero set rarely changes).
 * - Each IHeroListItem carries cardIdentifier, name, young, legalFormats, imageUrl.
 * - Null imageUrl is handled correctly (no crash on heroes without images).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useHeroesQuery,
  HEROES_QUERY_KEY,
  type IHeroListItem,
  type IHeroListResponse,
} from '../catalog';

// ---------------------------------------------------------------------------
// Mock useApiClient
// ---------------------------------------------------------------------------

const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', () => ({
  useApiClient: () => mockApiFetch,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeHero(overrides: Partial<IHeroListItem> = {}): IHeroListItem {
  return {
    cardIdentifier: 'katsu-the-wanderer-wtr',
    name: 'Katsu, the Wanderer',
    young: false,
    legalFormats: ['CC', 'Blitz'],
    imageUrl: 'https://d3o8hx28f8uam3.cloudfront.net/card/katsu-the-wanderer-wtr.webp',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// useHeroesQuery
// ---------------------------------------------------------------------------

describe('useHeroesQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('fetches GET /catalog/heroes and returns the hero list', async () => {
    const response: IHeroListResponse = {
      heroes: [
        makeHero(),
        makeHero({
          cardIdentifier: 'dorinthea-ironsong-wtr',
          name: 'Dorinthea Ironsong',
          young: false,
          legalFormats: ['CC', 'Blitz'],
        }),
      ],
    };
    mockApiFetch.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiFetch).toHaveBeenCalledWith('/catalog/heroes');
    expect(result.current.data?.heroes).toHaveLength(2);
  });

  it('returns heroes with the correct IHeroListItem shape', async () => {
    const katsu = makeHero();
    mockApiFetch.mockResolvedValueOnce({ heroes: [katsu] });

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hero = result.current.data?.heroes[0];
    expect(hero?.cardIdentifier).toBe('katsu-the-wanderer-wtr');
    expect(hero?.name).toBe('Katsu, the Wanderer');
    expect(hero?.young).toBe(false);
    expect(hero?.legalFormats).toEqual(['CC', 'Blitz']);
    expect(typeof hero?.imageUrl).toBe('string');
  });

  it('handles heroes with null imageUrl without crashing', async () => {
    const heroNoImage = makeHero({ imageUrl: null });
    mockApiFetch.mockResolvedValueOnce({ heroes: [heroNoImage] });

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.heroes[0]?.imageUrl).toBeNull();
  });

  it('handles young hero variant correctly', async () => {
    const youngKatsu = makeHero({
      cardIdentifier: 'katsu-wtr',
      name: 'Katsu',
      young: true,
      legalFormats: ['Blitz'],
    });
    mockApiFetch.mockResolvedValueOnce({ heroes: [youngKatsu] });

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.heroes[0]?.young).toBe(true);
    expect(result.current.data?.heroes[0]?.legalFormats).toEqual(['Blitz']);
  });

  it('uses HEROES_QUERY_KEY for caching', async () => {
    mockApiFetch.mockResolvedValueOnce({ heroes: [makeHero()] });

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the data is accessible under HEROES_QUERY_KEY
    const cached = queryClient.getQueryData<IHeroListResponse>(HEROES_QUERY_KEY);
    expect(cached?.heroes).toHaveLength(1);
  });

  it('does not refetch on second render — staleTime is Infinity', async () => {
    const response: IHeroListResponse = { heroes: [makeHero()] };
    mockApiFetch.mockResolvedValue(response);

    // First hook instance loads the data
    const { result: r1 } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    // Second hook instance on the same client — should use cache
    const { result: r2 } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    expect(r2.current.data?.heroes).toHaveLength(1);
    // Only one network call across both instances
    expect(mockApiFetch).toHaveBeenCalledOnce();
  });

  it('returns an empty heroes array gracefully', async () => {
    mockApiFetch.mockResolvedValueOnce({ heroes: [] });

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.heroes).toHaveLength(0);
  });

  it('surfaces fetch error via query.error', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useHeroesQuery(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

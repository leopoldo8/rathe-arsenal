/**
 * LIB-06: toggling a source must refetch the library (so totals and filtered
 * counts recompute from the active sources) and the sources list.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { usePatchCsvSourceMutation, CSV_SOURCES_QUERY_KEY } from '../csv-sources';
import type { ICsvSource } from '../csv-sources';
import { LIBRARY_QUERY_KEY } from '../library';

const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

function buildSource(overrides: Partial<ICsvSource> = {}): ICsvSource {
  return {
    id: 'src-1',
    userId: 'u',
    kind: 'csv',
    label: 'A',
    originalFilename: null,
    sourceUrl: null,
    contentHash: null,
    cardCount: 3,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('usePatchCsvSourceMutation — toggle recomputes library totals (LIB-06)', () => {
  let queryClient: QueryClient;
  let libraryFetches: number;

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (url: string) =>
      url.startsWith('/collection/sources/') ? buildSource({ active: false }) : {},
    );
    libraryFetches = 0;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(CSV_SOURCES_QUERY_KEY, [buildSource()]);
  });

  function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactElement {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('refetches the mounted library query after the PATCH succeeds', async () => {
    const { result } = renderHook(
      () => ({
        library: useQuery({
          queryKey: LIBRARY_QUERY_KEY,
          queryFn: async () => ++libraryFetches,
          staleTime: Infinity,
        }),
        patch: usePatchCsvSourceMutation(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.library.data).toBe(1));

    await act(async () => {
      result.current.patch.mutate({ sourceId: 'src-1', active: false });
    });

    await waitFor(() => expect(result.current.library.data).toBe(2));
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/collection/sources/src-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ active: false }) }),
    );
  });

  it('flips the row optimistically before the server answers', async () => {
    let release: (value: ICsvSource) => void = () => undefined;
    mockApiFetch.mockImplementation(
      () => new Promise<ICsvSource>((resolve) => { release = resolve; }),
    );
    const { result } = renderHook(() => usePatchCsvSourceMutation(), { wrapper });

    act(() => {
      result.current.mutate({ sourceId: 'src-1', active: false });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<readonly ICsvSource[]>(CSV_SOURCES_QUERY_KEY);
      expect(cached?.[0]?.active).toBe(false);
    });
    await act(async () => release(buildSource({ active: false })));
  });
});

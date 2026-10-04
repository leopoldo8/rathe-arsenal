import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { findFinishedJobDeckIds, useVariantJobsQuery } from '../variant-jobs';
import type { IVariantJob, IVariantJobsResponse } from '../variant-jobs';
import { deckDetailQueryKey } from '../deck-detail';

const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

function job(overrides: Partial<IVariantJob>): IVariantJob {
  return {
    jobId: 'job-1',
    deckId: 7,
    deckName: 'Deck',
    status: 'running',
    total: 14,
    completed: 0,
    failed: 0,
    ...overrides,
  };
}

function jobs(...list: IVariantJob[]): IVariantJobsResponse {
  return { jobs: list, etaSeconds: 0 };
}

describe('findFinishedJobDeckIds', () => {
  it('returns the deck of a job that went from running to done', () => {
    expect(findFinishedJobDeckIds(jobs(job({ status: 'running' })), jobs(job({ status: 'done' })))).toEqual([7]);
  });

  it('returns the deck of a job that failed or dropped off the list', () => {
    const previous = jobs(job({ deckId: 1, status: 'pending' }), job({ deckId: 2, status: 'running' }));
    expect(findFinishedJobDeckIds(previous, jobs(job({ deckId: 1, status: 'failed' })))).toEqual([1, 2]);
  });

  it('ignores jobs that are still active or were already finished', () => {
    const previous = jobs(job({ deckId: 1, status: 'running' }), job({ deckId: 2, status: 'done' }));
    const next = jobs(job({ deckId: 1, status: 'running' }), job({ deckId: 2, status: 'done' }));
    expect(findFinishedJobDeckIds(previous, next)).toEqual([]);
  });

  it('returns nothing on the first load, when there is no previous response', () => {
    expect(findFinishedJobDeckIds(undefined, jobs(job({ status: 'done' })))).toEqual([]);
  });
});

describe('useVariantJobsQuery — refreshes a deck once its exact-prices job finishes', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockApiFetch.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactElement {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('refetches the deck detail and the decks list when the job leaves running', async () => {
    mockApiFetch
      .mockResolvedValueOnce(jobs(job({ status: 'running' })))
      .mockResolvedValueOnce(jobs(job({ status: 'done', completed: 14 })));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useVariantJobsQuery(), { wrapper });
    await waitFor(() => expect(result.current.data?.jobs[0]?.status).toBe('running'));
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetch();
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: deckDetailQueryKey('7') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['decks'] });
  });

  it('does not refetch any deck on the first load', async () => {
    mockApiFetch.mockResolvedValueOnce(jobs(job({ status: 'done' })));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useVariantJobsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidate).not.toHaveBeenCalled();
  });
});

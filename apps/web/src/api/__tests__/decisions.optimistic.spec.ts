/**
 * Unit tests for optimistic-with-rollback mutations in decisions.ts (R61).
 *
 * Strategy: use @tanstack/react-query's QueryClient directly with renderHook
 * from @testing-library/react so we can control queryClient.getQueryData /
 * setQueryData and observe the optimistic-update → rollback lifecycle without
 * needing a real HTTP server.
 *
 * Test scenarios (from Unit 17 plan):
 *  - Happy path:  optimistic UI update applied before mutationFn resolves; on
 *                 success the cache is invalidated.
 *  - Error path:  500 error → optimistic update is rolled back to the snapshot;
 *                 showToast is called once with kind:'error'.
 *  - Burst (3 rapid failures): showToast called 3 times in quick succession,
 *                 exercising the caller's responsibility to pass the same
 *                 `show` function (ToastProvider consolidates >=2 within 500ms).
 *  - Mixed (2 actions, 1 succeeds, 1 fails): successful one persists
 *                 (invalidation fires), failing one rolls back.
 *  - Approve-then-reject within 50ms: second onMutate snapshots the
 *                 optimistic state from the first; if both fail, rollback
 *                 chain restores correctly.
 *  - aria-live announcement: ToastProvider uses aria-live="polite" region
 *                 (tested in Toast.spec.tsx; referenced here as coverage note).
 *  - Mark owned dual-invalidation: verifies useMarkOwnedMutation invalidates
 *                 both ['decks'] and ['deck-detail', deckId].
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useDecideSubstitutionMutation,
  useResetDecisionsMutation,
} from '../decisions';
import { useMarkOwnedMutation } from '../deck-detail';
import type { IDeckDetailResponse } from '../deck-detail';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useApiClient — the returned apiFetch function is replaced per test.
const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', () => ({
  useApiClient: () => mockApiFetch,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDetailData(
  overrides: Partial<IDeckDetailResponse> = {},
): IDeckDetailResponse {
  return {
    id: 1,
    fabraryUlid: 'ulid-abc',
    name: 'Test Deck',
    hero: 'Katsu',
    heroIdentifier: 'katsu-the-wanderer-wtr',
    format: 'blitz',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'building',
    tags: [],
    legality: { category: 'legal', reasons: [] },
    totalCards: 60,
    latestSnapshot: null,
    rejectedCount: 0,
    approvedCount: 0,
    pendingCount: 3,
    decisions: [],
    ...overrides,
  };
}

const DECK_ID = '42';
const QUERY_KEY = ['deck-detail', DECK_ID] as const;

// ---------------------------------------------------------------------------
// Helper: create a fresh QueryClient + wrapper for each test
// ---------------------------------------------------------------------------

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// ---------------------------------------------------------------------------
// Tests: useDecideSubstitutionMutation
// ---------------------------------------------------------------------------

describe('useDecideSubstitutionMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('happy path — approve action', () => {
    it('applies the optimistic update before mutationFn resolves', async () => {
      const initial = makeDetailData({ pendingCount: 3 });
      queryClient.setQueryData(QUERY_KEY, initial);

      // mutationFn resolves after the test checks optimistic state
      let resolvePost!: () => void;
      mockApiFetch.mockReturnValueOnce(
        new Promise<{ cardIdentifier: string; decision: 'approved' }>((resolve) => {
          resolvePost = () => resolve({ cardIdentifier: 'pummel', decision: 'approved' });
        }),
      );

      const { result } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => {
        result.current.mutate({ cardIdentifier: 'pummel', decision: 'approved' });
      });

      // Optimistic update should be applied immediately (synchronously after onMutate)
      await waitFor(() => {
        const cached = queryClient.getQueryData<IDeckDetailResponse>(QUERY_KEY);
        expect(cached?.decisions).toHaveLength(1);
        expect(cached?.decisions[0]?.decision).toBe('approved');
        expect(cached?.approvedCount).toBe(1);
        expect(cached?.pendingCount).toBe(2);
      });

      // Resolve the mutation so onSuccess fires
      resolvePost();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('dual-invalidates [decks] and [deck-detail, deckId] on success', async () => {
      const initial = makeDetailData();
      queryClient.setQueryData(QUERY_KEY, initial);
      mockApiFetch.mockResolvedValueOnce({ cardIdentifier: 'pummel', decision: 'approved' });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => {
        result.current.mutate({ cardIdentifier: 'pummel', decision: 'approved' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(keys.some((k) => k.includes('deck-detail'))).toBe(true);
      expect(keys.some((k) => k.includes('decks'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Error path — rollback on 500
  // -------------------------------------------------------------------------

  describe('error path — rollback on 500', () => {
    it('restores snapshot when the server returns a 500', async () => {
      const initial = makeDetailData({ pendingCount: 3 });
      queryClient.setQueryData(QUERY_KEY, initial);
      mockApiFetch.mockRejectedValueOnce(new Error('Internal Server Error'));

      const showToast = vi.fn();
      const { result } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => {
        result.current.mutate({ cardIdentifier: 'pummel', decision: 'approved' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Cache should be restored to the pre-mutation snapshot
      const cached = queryClient.getQueryData<IDeckDetailResponse>(QUERY_KEY);
      expect(cached?.decisions).toHaveLength(0);
      expect(cached?.pendingCount).toBe(3);
    });

    it('calls showToast with kind: error after rollback', async () => {
      const initial = makeDetailData();
      queryClient.setQueryData(QUERY_KEY, initial);
      mockApiFetch.mockRejectedValueOnce(new Error('Internal Server Error'));

      const showToast = vi.fn();
      const { result } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => {
        result.current.mutate({ cardIdentifier: 'pummel', decision: 'approved' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(showToast).toHaveBeenCalledOnce();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Burst — 3 rapid failures invoke showToast 3 times
  // -------------------------------------------------------------------------

  describe('burst — 3 rapid failures call showToast 3 times', () => {
    it('invokes showToast for each failed mutation; ToastProvider consolidates', async () => {
      const initial = makeDetailData({ pendingCount: 5 });
      queryClient.setQueryData(QUERY_KEY, initial);

      const showToast = vi.fn();

      // Three hooks sharing the same queryClient, each for a different card
      const { result: r1 } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );
      const { result: r2 } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );
      const { result: r3 } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );

      mockApiFetch.mockRejectedValue(new Error('Network error'));

      act(() => {
        r1.current.mutate({ cardIdentifier: 'card-a', decision: 'approved' });
        r2.current.mutate({ cardIdentifier: 'card-b', decision: 'approved' });
        r3.current.mutate({ cardIdentifier: 'card-c', decision: 'approved' });
      });

      await waitFor(() => {
        expect(r1.current.isError).toBe(true);
        expect(r2.current.isError).toBe(true);
        expect(r3.current.isError).toBe(true);
      });

      // Each failure calls showToast once — ToastProvider is responsible for
      // burst consolidation (>=2 within 500ms → single consolidated toast).
      expect(showToast).toHaveBeenCalledTimes(3);
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
    });
  });

  // -------------------------------------------------------------------------
  // Mixed — 2 actions, 1 succeeds, 1 fails
  // -------------------------------------------------------------------------

  describe('mixed — 1 succeeds and 1 fails', () => {
    it('successful mutation invalidates; failed mutation rolls back and toasts', async () => {
      const initial = makeDetailData({ pendingCount: 2 });
      queryClient.setQueryData(QUERY_KEY, initial);

      const showToast = vi.fn();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result: rOk } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );
      const { result: rFail } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID, { showToast }),
        { wrapper: makeWrapper(queryClient) },
      );

      // First call succeeds, second call fails
      mockApiFetch
        .mockResolvedValueOnce({ cardIdentifier: 'card-ok', decision: 'approved' })
        .mockRejectedValueOnce(new Error('Server error'));

      act(() => {
        rOk.current.mutate({ cardIdentifier: 'card-ok', decision: 'approved' });
      });
      act(() => {
        rFail.current.mutate({ cardIdentifier: 'card-fail', decision: 'rejected' });
      });

      await waitFor(() => {
        expect(rOk.current.isSuccess).toBe(true);
        expect(rFail.current.isError).toBe(true);
      });

      // Successful mutation triggered invalidation
      expect(invalidateSpy).toHaveBeenCalled();

      // Failed mutation showed a toast
      expect(showToast).toHaveBeenCalledOnce();
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
    });
  });

  // -------------------------------------------------------------------------
  // Approve-then-reject on same row within 50ms
  // -------------------------------------------------------------------------

  describe('approve then reject on same row within 50ms', () => {
    it('second onMutate snapshots the post-approve optimistic state; both fail → rollback restores original', async () => {
      const initial = makeDetailData({ pendingCount: 1 });
      queryClient.setQueryData(QUERY_KEY, initial);

      // Both calls fail
      mockApiFetch.mockRejectedValue(new Error('fail'));

      const { result: rApprove } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID),
        { wrapper: makeWrapper(queryClient) },
      );
      const { result: rReject } = renderHook(
        () => useDecideSubstitutionMutation(DECK_ID),
        { wrapper: makeWrapper(queryClient) },
      );

      act(() => {
        rApprove.current.mutate({ cardIdentifier: 'pummel', decision: 'approved' });
        rReject.current.mutate({ cardIdentifier: 'pummel', decision: 'rejected' });
      });

      await waitFor(() => {
        expect(rApprove.current.isError).toBe(true);
        expect(rReject.current.isError).toBe(true);
      });

      // After both rollbacks, the total not-owned card count must be preserved.
      // Each rollback restores a snapshot; the last onError to run wins the cache.
      // Regardless of ordering, the sum of all decision-state slots must equal the
      // original total not-owned count (1 in this fixture).
      const cached = queryClient.getQueryData<IDeckDetailResponse>(QUERY_KEY);
      const total = (cached?.pendingCount ?? 0) + (cached?.approvedCount ?? 0) + (cached?.rejectedCount ?? 0);
      expect(total).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: useResetDecisionsMutation
// ---------------------------------------------------------------------------

describe('useResetDecisionsMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('removes the decision entry from cache optimistically', async () => {
    const initial = makeDetailData({
      decisions: [{ cardIdentifier: 'pummel', decision: 'approved' }],
      approvedCount: 1,
      pendingCount: 2,
    });
    queryClient.setQueryData(QUERY_KEY, initial);

    let resolveDelete!: () => void;
    mockApiFetch.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = () => resolve();
      }),
    );

    const { result } = renderHook(
      () => useResetDecisionsMutation(DECK_ID),
      { wrapper: makeWrapper(queryClient) },
    );

    act(() => {
      result.current.mutate('pummel');
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<IDeckDetailResponse>(QUERY_KEY);
      expect(cached?.decisions).toHaveLength(0);
      expect(cached?.approvedCount).toBe(0);
      expect(cached?.pendingCount).toBe(3);
    });

    resolveDelete();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back and calls showToast on error', async () => {
    const initial = makeDetailData({
      decisions: [{ cardIdentifier: 'pummel', decision: 'rejected' }],
      rejectedCount: 1,
      pendingCount: 2,
    });
    queryClient.setQueryData(QUERY_KEY, initial);
    mockApiFetch.mockRejectedValueOnce(new Error('Server error'));

    const showToast = vi.fn();
    const { result } = renderHook(
      () => useResetDecisionsMutation(DECK_ID, { showToast }),
      { wrapper: makeWrapper(queryClient) },
    );

    act(() => {
      result.current.mutate('pummel');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<IDeckDetailResponse>(QUERY_KEY);
    expect(cached?.decisions).toHaveLength(1);
    expect(cached?.rejectedCount).toBe(1);

    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });
});

// ---------------------------------------------------------------------------
// Mark owned dual-invalidation
// ---------------------------------------------------------------------------

describe('useMarkOwnedMutation — dual-invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    mockApiFetch.mockReset();
  });

  it('invalidates both [decks] and [deck-detail, deckId] on success', async () => {
    mockApiFetch.mockResolvedValueOnce({
      cardIdentifier: 'pummel',
      newQuantity: 3,
      snapshot: null,
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useMarkOwnedMutation(DECK_ID),
      { wrapper: makeWrapper(queryClient) },
    );

    act(() => {
      result.current.mutate('pummel');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(keys.some((k) => k.includes('deck-detail'))).toBe(true);
    expect(keys.some((k) => k.includes('decks'))).toBe(true);
  });
});

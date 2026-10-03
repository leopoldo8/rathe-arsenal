import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client';
import { useMarkOwnedMutation } from '../deck-detail';
import {
  findSwap,
  isInvalidTransition,
  replaceDeckSlice,
  selectDeckSwaps,
  SWAPS_QUERY_KEY,
  useRestoreRejectedSwaps,
  useSwapBatch,
  useSwapMutation,
} from '../swaps';
import type { IRestoreRejectedResult, ISwapMutationResult, ISwapsResponse } from '../swaps';
import { BULK_MAX_ROWS } from '../../components/swaps/swap-bulk';
import { makeSwapRow } from '../../test/swap-fixtures';

const mockApiFetch = vi.fn();

vi.mock('../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapperFor(client: QueryClient): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('replaceDeckSlice', () => {
  it('replaces only the acted-on deck and keeps every other deck byte for byte', () => {
    const otherDeck = makeSwapRow({ trackedDeckId: 2 });
    const first = makeSwapRow({ trackedDeckId: 1 });
    const second = makeSwapRow({ trackedDeckId: 1 });
    const updatedFirst = { ...first, status: 'approved' as const };

    const result = replaceDeckSlice([first, otherDeck, second], 1, [updatedFirst, second]);

    expect(result).toEqual([updatedFirst, otherDeck, second]);
    expect(result[1]).toBe(otherDeck);
  });

  it('keeps the position of an updated row so a list does not reorder under the reader', () => {
    const a = makeSwapRow({ trackedDeckId: 1 });
    const b = makeSwapRow({ trackedDeckId: 2 });
    const c = makeSwapRow({ trackedDeckId: 1 });

    const result = replaceDeckSlice([a, b, c], 1, [c, { ...a, status: 'rejected' }]);

    expect(result.map((row) => row.id)).toEqual([a.id, b.id, c.id]);
  });

  it('drops a row the server no longer returns, as a retired row is', () => {
    const kept = makeSwapRow({ trackedDeckId: 1 });
    const retired = makeSwapRow({ trackedDeckId: 1 });

    expect(replaceDeckSlice([kept, retired], 1, [kept])).toEqual([kept]);
  });

  it('appends a row the cascade created and the list did not have', () => {
    const existing = makeSwapRow({ trackedDeckId: 1 });
    const created = makeSwapRow({ trackedDeckId: 1 });

    expect(replaceDeckSlice([existing], 1, [existing, created]).map((r) => r.id)).toEqual([
      existing.id,
      created.id,
    ]);
  });
});

describe('findSwap and selectDeckSwaps', () => {
  const rows = [
    makeSwapRow({ id: 'a', trackedDeckId: 1, cardIdentifier: 'x', slot: 'mainboard', substituteIdentifier: 's' }),
    makeSwapRow({ id: 'b', trackedDeckId: 1, cardIdentifier: 'x', slot: 'equipment', substituteIdentifier: 's' }),
    makeSwapRow({ id: 'c', trackedDeckId: 2, cardIdentifier: 'x', slot: 'mainboard', substituteIdentifier: 's' }),
  ];

  it('matches on card, slot and substitute together', () => {
    expect(
      findSwap(rows, { cardIdentifier: 'x', slot: 'equipment', substituteIdentifier: 's' })?.id,
    ).toBe('b');
  });

  it('does not match when only the substitute is the same', () => {
    expect(
      findSwap(rows, { cardIdentifier: 'y', slot: 'mainboard', substituteIdentifier: 's' }),
    ).toBeUndefined();
  });

  it('keeps only the rows of the requested deck', () => {
    expect(selectDeckSwaps(rows, 1).map((r) => r.id)).toEqual(['a', 'b']);
    expect(selectDeckSwaps(undefined, 1)).toEqual([]);
  });
});

describe('useSwapMutation', () => {
  function seed(client: QueryClient, rows: ISwapsResponse['rows']): void {
    client.setQueryData<ISwapsResponse>(SWAPS_QUERY_KEY, { rows });
  }

  it.each([
    [{ kind: 'approve' }, 'approve', undefined],
    [{ kind: 'revert' }, 'revert', undefined],
    [{ kind: 'restore' }, 'restore', undefined],
    [{ kind: 'reject', reason: 'dont_own', note: 'no copies' }, 'reject', { reason: 'dont_own', note: 'no copies' }],
    [{ kind: 'reject' }, 'reject', {}],
    [{ kind: 'outcome', outcome: 'worked' }, 'outcome', { outcome: 'worked' }],
  ] as const)('sends %j to POST /swaps/:id/%s', async (action, path, body) => {
    const client = makeClient();
    const row = makeSwapRow();
    seed(client, [row]);
    const result: ISwapMutationResult = { deckId: 1, swap: row, rows: [row] };
    mockApiFetch.mockResolvedValueOnce(result);

    const { result: hook } = renderHook(() => useSwapMutation(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await hook.current.mutateAsync({ swapId: row.id, action });
    });

    const [url, init] = mockApiFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/swaps/${row.id}/${path}`);
    expect(init.method).toBe('POST');
    expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
  });

  it('never sends the localized label, only the reason enum key', async () => {
    const client = makeClient();
    const row = makeSwapRow();
    seed(client, [row]);
    mockApiFetch.mockResolvedValueOnce({ deckId: 1, swap: row, rows: [row] });

    const { result: hook } = renderHook(() => useSwapMutation(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await hook.current.mutateAsync({
        swapId: row.id,
        action: { kind: 'reject', reason: 'prefer_original' },
      });
    });

    const body = (mockApiFetch.mock.calls[0] as [string, RequestInit])[1].body as string;
    expect(JSON.parse(body)).toEqual({ reason: 'prefer_original' });
  });

  it('writes the response into the cached list, replacing only that deck', async () => {
    const client = makeClient();
    const target = makeSwapRow({ trackedDeckId: 1 });
    const sibling = makeSwapRow({ trackedDeckId: 1 });
    const other = makeSwapRow({ trackedDeckId: 2 });
    seed(client, [target, other, sibling]);
    const approved = { ...target, status: 'approved' as const };
    mockApiFetch.mockResolvedValueOnce({ deckId: 1, swap: approved, rows: [approved, sibling] });

    const { result: hook } = renderHook(() => useSwapMutation(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await hook.current.mutateAsync({ swapId: target.id, action: { kind: 'approve' } });
    });

    const cached = client.getQueryData<ISwapsResponse>(SWAPS_QUERY_KEY);
    expect(cached?.rows).toEqual([approved, other, sibling]);
  });

  it('refreshes the deck list and that deck detail so readiness numbers follow', async () => {
    const client = makeClient();
    const row = makeSwapRow({ trackedDeckId: 7 });
    seed(client, [row]);
    mockApiFetch.mockResolvedValueOnce({ deckId: 7, swap: row, rows: [row] });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result: hook } = renderHook(() => useSwapMutation(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await hook.current.mutateAsync({ swapId: row.id, action: { kind: 'approve' } });
    });

    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    expect(keys).toContain(JSON.stringify(['decks']));
    expect(keys).toContain(JSON.stringify(['deck-detail', '7']));
  });

  it('resyncs the whole list when the swap already moved (409)', async () => {
    const client = makeClient();
    const row = makeSwapRow();
    seed(client, [row]);
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(409, JSON.stringify({ code: 'INVALID_TRANSITION', message: 'no' })),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result: hook } = renderHook(() => useSwapMutation(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await expect(
        hook.current.mutateAsync({ swapId: row.id, action: { kind: 'approve' } }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: SWAPS_QUERY_KEY });
  });

  it('leaves the cache alone on a server error', async () => {
    const client = makeClient();
    const row = makeSwapRow();
    seed(client, [row]);
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, 'boom'));
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result: hook } = renderHook(() => useSwapMutation(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await expect(
        hook.current.mutateAsync({ swapId: row.id, action: { kind: 'approve' } }),
      ).rejects.toBeInstanceOf(ApiError);
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(client.getQueryData<ISwapsResponse>(SWAPS_QUERY_KEY)?.rows).toEqual([row]);
  });

  it('recognises a 409 INVALID_TRANSITION and nothing else', () => {
    expect(isInvalidTransition(new ApiError(409, '{"code":"INVALID_TRANSITION"}'))).toBe(true);
    expect(isInvalidTransition(new ApiError(409, 'other conflict'))).toBe(false);
    expect(isInvalidTransition(new ApiError(500, 'INVALID_TRANSITION'))).toBe(false);
  });
});

describe('useSwapBatch', () => {
  it('writes each response into the cache at once but refreshes readiness only in finish', async () => {
    const client = makeClient();
    const a = makeSwapRow({ trackedDeckId: 1 });
    const b = makeSwapRow({ trackedDeckId: 1 });
    const c = makeSwapRow({ trackedDeckId: 2 });
    client.setQueryData<ISwapsResponse>(SWAPS_QUERY_KEY, { rows: [a, b, c] });
    mockApiFetch
      .mockResolvedValueOnce({ deckId: 1, swap: a, rows: [{ ...a, status: 'approved' }, b] })
      .mockResolvedValueOnce({ deckId: 1, swap: b, rows: [{ ...a, status: 'approved' }, { ...b, status: 'approved' }] })
      .mockResolvedValueOnce({ deckId: 2, swap: c, rows: [{ ...c, status: 'approved' }] });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSwapBatch(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.perform({ swapId: a.id, action: { kind: 'approve' } });
      await result.current.perform({ swapId: b.id, action: { kind: 'approve' } });
      await result.current.perform({ swapId: c.id, action: { kind: 'approve' } });
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(client.getQueryData<ISwapsResponse>(SWAPS_QUERY_KEY)?.rows.map((row) => row.status)).toEqual([
      'approved',
      'approved',
      'approved',
    ]);

    act(() => result.current.finish());

    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    expect(keys.filter((key) => key === JSON.stringify(['decks']))).toHaveLength(2);
    expect(keys).toContain(JSON.stringify(['deck-detail', '1']));
    expect(keys).toContain(JSON.stringify(['deck-detail', '2']));
  });

  it('refreshes a deck only once however many of its swaps were touched', async () => {
    const client = makeClient();
    const a = makeSwapRow({ trackedDeckId: 1 });
    client.setQueryData<ISwapsResponse>(SWAPS_QUERY_KEY, { rows: [a] });
    mockApiFetch.mockResolvedValue({ deckId: 1, swap: a, rows: [a] });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSwapBatch(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current.perform({ swapId: a.id, action: { kind: 'approve' } });
      await result.current.perform({ swapId: a.id, action: { kind: 'revert' } });
    });
    act(() => result.current.finish());

    const detailRefreshes = invalidate.mock.calls.filter(
      (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['deck-detail', '1']),
    );
    expect(detailRefreshes).toHaveLength(1);
  });
});

describe('useRestoreRejectedSwaps', () => {
  it('restores every rejected swap one call at a time and reports a partial failure', async () => {
    const client = makeClient();
    const rows = [
      makeSwapRow({ status: 'rejected' }),
      makeSwapRow({ status: 'rejected' }),
      makeSwapRow({ status: 'rejected' }),
    ];
    client.setQueryData<ISwapsResponse>(SWAPS_QUERY_KEY, { rows });
    mockApiFetch
      .mockResolvedValueOnce({ deckId: 1, swap: rows[0], rows })
      .mockRejectedValueOnce(new ApiError(500, 'boom'))
      .mockResolvedValueOnce({ deckId: 1, swap: rows[2], rows });

    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result: hook } = renderHook(() => useRestoreRejectedSwaps(), {
      wrapper: wrapperFor(client),
    });
    let outcome: IRestoreRejectedResult | undefined;
    await act(async () => {
      outcome = await hook.current.mutateAsync(rows);
    });

    expect(outcome).toEqual({ restored: 2, failed: 1, attempted: 3, remaining: 0 });
    const urls = mockApiFetch.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(rows.map((row) => `/swaps/${row.id}/restore`));
    const detailRefreshes = invalidate.mock.calls.filter(
      (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(['deck-detail', '1']),
    );
    expect(detailRefreshes).toHaveLength(1);
  });

  it('sends at most BULK_MAX_ROWS requests and reports how many rows remain', async () => {
    const client = makeClient();
    const rows = Array.from({ length: BULK_MAX_ROWS + 1 }, () => makeSwapRow({ status: 'rejected' }));
    client.setQueryData<ISwapsResponse>(SWAPS_QUERY_KEY, { rows });
    mockApiFetch.mockResolvedValue({ deckId: 1, swap: rows[0], rows });

    const { result: hook } = renderHook(() => useRestoreRejectedSwaps(), {
      wrapper: wrapperFor(client),
    });
    let outcome: IRestoreRejectedResult | undefined;
    await act(async () => {
      outcome = await hook.current.mutateAsync(rows);
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(BULK_MAX_ROWS);
    expect(outcome).toEqual({
      restored: BULK_MAX_ROWS,
      failed: 0,
      attempted: BULK_MAX_ROWS,
      remaining: 1,
    });
  });
});

describe('useMarkOwnedMutation — dual-invalidation', () => {
  it('invalidates both [decks] and [deck-detail, deckId] on success', async () => {
    const client = makeClient();
    mockApiFetch.mockResolvedValueOnce({ cardIdentifier: 'pummel', newQuantity: 3, snapshot: null });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useMarkOwnedMutation('42'), { wrapper: wrapperFor(client) });
    act(() => {
      result.current.mutate('pummel');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(keys.some((key) => key.includes('deck-detail'))).toBe(true);
    expect(keys.some((key) => key.includes('decks'))).toBe(true);
  });
});

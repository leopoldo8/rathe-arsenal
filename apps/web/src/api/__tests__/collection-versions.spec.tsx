import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';

const apiFetch = vi.fn().mockResolvedValue({});
vi.mock('../../lib/api-client', () => ({ useApiClient: () => apiFetch }));

import {
  useCardVersionOptionsQuery,
  useMarkSourceVersionsMutation,
  useMoveCopiesMutation,
  useSourceCopiesQuery,
} from '../collection-versions';

const HOSTILE = '../x/y?z=1#frag';
const ENCODED = encodeURIComponent(HOSTILE);

function wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('collection versions requests', () => {
  it('a value with ../, /, ? or # does not change the requested path', async () => {
    apiFetch.mockClear();

    renderHook(() => useCardVersionOptionsQuery(HOSTILE), { wrapper });
    renderHook(() => useSourceCopiesQuery(HOSTILE), { wrapper });
    const mark = renderHook(() => useMarkSourceVersionsMutation(), { wrapper });
    const move = renderHook(() => useMoveCopiesMutation(), { wrapper });
    mark.result.current.mutate({ sourceId: HOSTILE, finish: 'none' });
    move.result.current.mutate({
      cardIdentifier: HOSTILE,
      from: { printingCode: '', edition: '', finish: '', condition: '' },
      to: { printingCode: 'WTR167', edition: '', finish: '', condition: '' },
      quantity: 1,
    });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(4));
    expect(apiFetch.mock.calls.map((call) => call[0]).sort()).toEqual(
      [
        `/catalog/cards/${ENCODED}/versions`,
        `/collection/sources/${ENCODED}/copies`,
        `/collection/sources/${ENCODED}/versions`,
        `/collection/cards/${ENCODED}/versions`,
      ].sort(),
    );
  });
});

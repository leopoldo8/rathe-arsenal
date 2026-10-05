/**
 * /swaps never shows the keep-or-go-back prompt of a card replacement: it
 * belongs to the deck page only (card-alternatives, AC 63). Drives the real
 * page against a fake swaps API whose rows sit next to an active replacement
 * whose original is owned.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ISwapRow } from '../../../api/swaps';
import { makeSwapRow } from '../../../test/swap-fixtures';

const rows: ISwapRow[] = [
  makeSwapRow({ id: 'p1', status: 'pending' }),
  makeSwapRow({ id: 'a1', status: 'approved', appliedAt: new Date().toISOString() }),
];

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    useSearch: () => ({ state: 'all', tier: [], deck: [], hero: [], confidenceMin: 0, confidenceMax: 100 }),
    useNavigate: () => vi.fn(),
    component: config.component,
  }),
  Link: (props: { to: string; children: React.ReactNode; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}));

vi.mock('../../../components/ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return {
    ...actual,
    useApiClient: () => async (url: string) => {
      if (url.startsWith('/swaps')) return { rows };
      return {
        replacements: [
          {
            id: 'replacement-1',
            slot: 'mainboard',
            originalCardIdentifier: 'emissary-of-tides-red',
            originalName: 'Emissary of Tides',
            replacementCardIdentifier: 'coax-a-commotion-red',
            quantity: 2,
            originalOwned: true,
          },
        ],
      };
    },
  };
});

import { Route } from '../swaps';

const SwapsPage = (Route as unknown as { component: React.FC }).component;

describe('/swaps replacement prompt', () => {
  it('shows no replacement prompt', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SwapsPage />
      </QueryClientProvider>,
    );
    await screen.findAllByTestId('swap-row');

    expect(screen.queryByTestId('replacement-prompt')).toBeNull();
    expect(screen.queryByText(/agora você tem a original/i)).toBeNull();
  });
});

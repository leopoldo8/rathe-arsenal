import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers, response } from '../../spare/__tests__/spareKit';
import type { ISpareResponse } from '../../../api/spare';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const LIBRARY = vi.hoisted(() => ({
  cards: [
    {
      cardIdentifier: 'WTR000',
      name: 'Test Card',
      pitch: 1,
      types: ['attack'],
      subtypes: [],
      classes: [],
      talents: [],
      sets: ['WTR'],
      imageUrl: null,
      ownedQuantity: 1,
      contributions: [],
    },
  ],
  stats: {
    uniqueCount: 1,
    totalCopies: 1,
    pitchBreakdown: { red: 1, yellow: 0, blue: 0, colorless: 0 },
    estimatedValueCents: 0,
    pricedIdentifierCount: 0,
    priceDataLastUpdatedAt: null,
  },
  setNames: {},
}));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useSearch: () => ({ pitches: [], types: [], classes: [], talents: [], sets: [], group: 'type', cardSize: 120 }),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../../../api/library', () => ({
  useLibraryQuery: () => ({ isLoading: false, isError: false, data: LIBRARY }),
  LIBRARY_QUERY_KEY: ['library'],
  DEFAULT_LIBRARY_SEARCH: { pitches: [], types: [], classes: [], talents: [], sets: [], group: 'type', cardSize: 120 },
}));
vi.mock('../../../api/collection', () => ({
  useAddCardMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useDecrementCardMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('../../../api/collection-imports', () => ({ usePendingLinesQuery: () => ({ data: { imports: [] } }) }));
vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: () => ({ data: { results: [] }, isFetching: false, isSuccess: true }),
  CATALOG_SEARCH_QUERY_KEY: ['catalog', 'search'],
}));
vi.mock('../../card-art/CardArt', () => ({ CardArt: ({ name }: { name: string }) => <div data-testid="card-art" aria-label={name} /> }));

import { SpareBanner } from '../SpareBanner';
import { LibraryPageInner } from '../../../routes/_auth/library';

function renderBanner(data: ISpareResponse): void {
  api.fetch.mockResolvedValue(data);
  render(
    <Providers>
      <SpareBanner />
    </Providers>,
  );
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('SpareBanner', () => {
  it('the banner names spare copies with no number and opens Sobrando', async () => {
    renderBanner(response());

    const banner = await screen.findByTestId('spare-banner');
    expect(banner).toHaveTextContent('Você tem cópias sobrando');
    expect(banner).toHaveTextContent('Ver');
    expect(banner.textContent).not.toMatch(/\d/);
    expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/spare');
  });

  it('the banner names spare copies with no number and opens Sobrando, above the card grid', async () => {
    api.fetch.mockResolvedValue(response());
    render(
      <Providers>
        <LibraryPageInner />
      </Providers>,
    );

    const banner = await screen.findByTestId('spare-banner');
    const firstCard = await screen.findByTestId('card-art');
    expect(banner.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING, 'the banner comes before the grid').toBeTruthy();
  });

  it('shows while the count still waits for the rule', async () => {
    renderBanner(response({ needsRule: true, rule: null, rows: [], totalSpare: 0 }));

    expect(await screen.findByTestId('spare-banner')).toBeInTheDocument();
  });

  it('is absent when there are no spare rows', async () => {
    renderBanner(response({ rows: [], totalSpare: 0 }));

    await vi.waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('spare-banner')).toBeNull();
  });
});

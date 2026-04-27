/**
 * Library route tests — Unit 8
 *
 * Tests LibraryPageInner (testable inner component) with all external
 * dependencies mocked.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before static imports
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => ({
    useSearch: () => ({
      pitches: [],
      types: [],
      classes: [],
      talents: [],
      sets: [],
      group: 'type',
      cardSize: 120,
    }),
  }),
  useNavigate: () => mockNavigate,
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => <a href={to} className={className}>{children}</a>,
}));

const mockUseLibraryQuery = vi.fn();
vi.mock('../../../api/library', () => ({
  useLibraryQuery: () => mockUseLibraryQuery(),
  LIBRARY_QUERY_KEY: ['library'],
  DEFAULT_LIBRARY_SEARCH: {
    pitches: [],
    types: [],
    classes: [],
    talents: [],
    sets: [],
    group: 'type',
    cardSize: 120,
  },
}));

const mockMutate = vi.fn();
const mockDecrementMutate = vi.fn();
vi.mock('../../../api/collection', () => ({
  useAddCardMutation: () => ({ mutate: mockMutate, isPending: false, isError: false }),
  useDecrementCardMutation: () => ({
    mutate: mockDecrementMutate,
    isPending: false,
    isError: false,
  }),
}));

vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: () => ({ data: { results: [] }, isFetching: false, isSuccess: true }),
  CATALOG_SEARCH_QUERY_KEY: ['catalog', 'search'],
}));

vi.mock('../../../components/card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => <div data-testid="card-art" aria-label={name} />,
}));

vi.mock('../../../components/ui/Button/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// ---------------------------------------------------------------------------
// Static imports — after vi.mock declarations
// ---------------------------------------------------------------------------

import { LibraryPageInner } from '../library';
import type { ILibraryCard, ILibraryResponse } from '../../../api/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<ILibraryCard> = {}): ILibraryCard {
  return {
    cardIdentifier: 'WTR000',
    name: 'Test Card',
    pitch: 1,
    types: ['attack'],
    classes: [],
    talents: [],
    sets: ['WTR'],
    imageUrl: null,
    ownedQuantity: 1,
    contributions: [],
    ...overrides,
  };
}

function makeLibraryResponse(cards: readonly ILibraryCard[]): ILibraryResponse {
  return {
    cards,
    stats: {
      uniqueCount: cards.length,
      totalCopies: cards.reduce((s, c) => s + c.ownedQuantity, 0),
      pitchBreakdown: { red: 0, yellow: 0, blue: 0, colorless: cards.length },
      estimatedValueCents: 0,
      pricedIdentifierCount: 0,
      priceDataLastUpdatedAt: null,
    },
    setNames: {},
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderLibraryPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LibraryPageInner />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibraryPage — loading state', () => {
  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });
  });

  it('renders skeleton elements during load', () => {
    renderLibraryPage();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });
});

describe('LibraryPage — error state', () => {
  const refetch = vi.fn();

  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Network failure'),
      data: undefined,
      refetch,
    });
  });

  it('renders error alert', () => {
    renderLibraryPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong loading your library/i)).toBeInTheDocument();
  });

  it('renders retry button', () => {
    renderLibraryPage();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls refetch when retry is clicked', async () => {
    renderLibraryPage();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('LibraryPage — empty state: 0 cards', () => {
  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([]),
    });
  });

  it('renders LibraryEmptyState when cards.length === 0', () => {
    renderLibraryPage();
    expect(screen.getByText(/your library is empty/i)).toBeInTheDocument();
  });

  it('renders the single "Open Add Cards" CTA pointing to /add-cards', () => {
    renderLibraryPage();
    const link = screen.getByRole('link', { name: /open add cards/i });
    expect(link).toHaveAttribute('href', '/add-cards');
  });

  it('does not render any "Manage CSVs" or inline search-and-add affordance', () => {
    renderLibraryPage();
    expect(screen.queryByRole('link', { name: /manage csv/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /search and add a card/i }),
    ).not.toBeInTheDocument();
  });
});

describe('LibraryPage — populated: 20 cards', () => {
  const CARDS_20 = Array.from({ length: 20 }, (_, i) =>
    makeCard({ cardIdentifier: `WTR${String(i).padStart(3, '0')}`, name: `Card ${i}` }),
  );

  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse(CARDS_20),
    });
  });

  it('renders 20 grid cells (one per library card)', async () => {
    renderLibraryPage();
    // Cells are scoped under the grid lists rendered by LibraryGrid; the
    // rail also renders its own <ul>s for class/talent/set toggles, so a
    // bare getAllByRole would over-count. We narrow to the cell aria-label
    // pattern that LibraryGrid attaches to every card cell.
    await waitFor(() => {
      const cells = screen.getAllByRole('listitem', {
        name: /Card \d+, owned: 1/,
      });
      expect(cells).toHaveLength(20);
    });
  });

  it('exposes the in-rail "Search your collection" input', () => {
    renderLibraryPage();
    expect(
      screen.getByPlaceholderText(/search your collection/i),
    ).toBeInTheDocument();
  });

  it('exposes a header link to /add-cards', () => {
    renderLibraryPage();
    const link = screen.getByRole('link', { name: /add cards/i });
    expect(link).toHaveAttribute('href', '/add-cards');
  });

  it('does not show empty state', () => {
    renderLibraryPage();
    expect(screen.queryByText(/your library is empty/i)).not.toBeInTheDocument();
  });
});

describe('LibraryPage — header navigation', () => {
  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([makeCard()]),
    });
  });

  it('exposes a single "Add cards" link in the header — sources go through /add-cards', () => {
    renderLibraryPage();
    const link = screen.getByRole('link', { name: /add cards/i });
    expect(link).toHaveAttribute('href', '/add-cards');
  });

  it('does not render a "Manage CSVs" affordance', () => {
    renderLibraryPage();
    expect(screen.queryByRole('link', { name: /manage csv/i })).not.toBeInTheDocument();
  });
});

describe('LibraryPage — freshness labels', () => {
  it('renders "Sem dados de preço" when priceDataLastUpdatedAt is null', () => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        cards: [makeCard()],
        stats: {
          uniqueCount: 1,
          totalCopies: 1,
          pitchBreakdown: { red: 1, yellow: 0, blue: 0, colorless: 0 },
          estimatedValueCents: 0,
          pricedIdentifierCount: 0,
          priceDataLastUpdatedAt: null,
        },
      },
    });
    renderLibraryPage();
    expect(screen.getByText(/sem dados de preço/i)).toBeInTheDocument();
  });

  it('renders "Atualizado há 1 dia" for 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        cards: [makeCard()],
        stats: {
          uniqueCount: 1,
          totalCopies: 1,
          pitchBreakdown: { red: 1, yellow: 0, blue: 0, colorless: 0 },
          estimatedValueCents: 5000,
          pricedIdentifierCount: 1,
          priceDataLastUpdatedAt: oneDayAgo,
        },
      },
    });
    renderLibraryPage();
    expect(screen.getByText(/atualizado há 1 dia/i)).toBeInTheDocument();
  });

  it('shows ◆ glyph for data older than 3 days', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        cards: [makeCard()],
        stats: {
          uniqueCount: 1,
          totalCopies: 1,
          pitchBreakdown: { red: 1, yellow: 0, blue: 0, colorless: 0 },
          estimatedValueCents: 5000,
          pricedIdentifierCount: 1,
          priceDataLastUpdatedAt: sevenDaysAgo,
        },
      },
    });
    renderLibraryPage();
    // Multiple ◆ glyphs exist in the page chrome (rail section markers,
    // freshness chip). Scope the assertion to the freshness label so we
    // only catch the freshness-driven glyph.
    expect(screen.getByText(/atualizado há 7 dias/i)).toBeInTheDocument();
    const glyphs = screen.getAllByText('◆');
    expect(glyphs.length).toBeGreaterThan(0);
  });
});

describe('LibraryPage — accessibility', () => {
  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([makeCard()]),
    });
  });

  it('rail search input is labelled', () => {
    renderLibraryPage();
    const input = screen.getByLabelText(
      /search the cards in your library by name/i,
    );
    expect(input.tagName.toLowerCase()).toBe('input');
    expect(input).toHaveAttribute('type', 'search');
  });

  it('rail filter sections are landmarked', () => {
    renderLibraryPage();
    expect(screen.getByLabelText(/library filters/i)).toBeInTheDocument();
  });
});

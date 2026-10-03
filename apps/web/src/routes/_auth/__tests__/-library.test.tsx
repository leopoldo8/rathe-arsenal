/**
 * Library route tests — Unit 8
 *
 * Tests LibraryPageInner (testable inner component) with all external
 * dependencies mocked.
 *
 * Assertions use PT-BR strings (i18n default in test harness).
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    subtypes: [],
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

  it('renders error alert (pt-BR)', () => {
    renderLibraryPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/algo deu errado ao carregar sua biblioteca/i)).toBeInTheDocument();
  });

  it('renders retry button (pt-BR)', () => {
    renderLibraryPage();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('calls refetch when retry is clicked', async () => {
    renderLibraryPage();
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
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

  it('renders LibraryEmptyState when cards.length === 0 (pt-BR)', () => {
    renderLibraryPage();
    expect(screen.getByText(/sua biblioteca está vazia/i)).toBeInTheDocument();
  });

  it('renders the single Add cards CTA pointing to /add-cards (pt-BR)', () => {
    renderLibraryPage();
    const link = screen.getByRole('link', { name: /adicionar cards/i });
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

  it('renders 20 grid cells (one per library card) with pt-BR aria-labels', async () => {
    renderLibraryPage();
    // Cells are scoped under the grid lists rendered by LibraryGrid; the
    // rail also renders its own <ul>s for class/talent/set toggles, so a
    // bare getAllByRole would over-count. We narrow to the cell aria-label
    // pattern that LibraryGrid attaches to every card cell.
    await waitFor(() => {
      const cells = screen.getAllByRole('listitem', {
        name: /Card \d+, na coleção: 1/,
      });
      expect(cells).toHaveLength(20);
    });
  });

  it('exposes the in-rail "Buscar na coleção" placeholder (pt-BR)', () => {
    renderLibraryPage();
    expect(
      screen.getByPlaceholderText(/buscar na coleção/i),
    ).toBeInTheDocument();
  });

  it('exposes a header link to /add-cards (pt-BR)', () => {
    renderLibraryPage();
    const link = screen.getByRole('link', { name: /adicionar cards/i });
    expect(link).toHaveAttribute('href', '/add-cards');
  });

  it('does not show empty state', () => {
    renderLibraryPage();
    expect(screen.queryByText(/sua biblioteca está vazia/i)).not.toBeInTheDocument();
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

  it('exposes a single "Adicionar cards" link in the header — sources go through /add-cards (pt-BR)', () => {
    renderLibraryPage();
    const link = screen.getByRole('link', { name: /adicionar cards/i });
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

  it('rail search input is labelled (pt-BR)', () => {
    renderLibraryPage();
    const input = screen.getByLabelText(
      /buscar cards na biblioteca por nome/i,
    );
    expect(input.tagName.toLowerCase()).toBe('input');
    expect(input).toHaveAttribute('type', 'search');
  });

  it('rail filter sections are landmarked (pt-BR)', () => {
    renderLibraryPage();
    expect(screen.getByLabelText(/filtros da biblioteca/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — LIB-01..04 and the stepper surviving the redesign
// ---------------------------------------------------------------------------

describe('LibraryPage — sidebar keeps every filter (LIB-01)', () => {
  beforeEach(() => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([
        makeCard({ cardIdentifier: 'A', name: 'Alpha', classes: ['Brute'], talents: ['Lightning'], sets: ['WTR'] }),
      ]),
    });
  });

  it('exposes search, four pitch chips, three facets, size slider and four group modes', () => {
    renderLibraryPage();
    expect(screen.getByRole('searchbox', { name: /buscar cards na biblioteca/i })).toBeInTheDocument();
    for (const name of [/Vermelho pitch/, /Amarelo pitch/, /Azul pitch/, /Incolor pitch/]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
    for (const name of [/Classe/, /Talento/, /^Set/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('slider', { name: /tamanho dos cards em pixels/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('links to the sources page from the sidebar', () => {
    renderLibraryPage();
    expect(screen.getByRole('link', { name: /gerenciar fontes/i })).toHaveAttribute(
      'href',
      '/library-csv-sources',
    );
  });

  it('filtering by pitch narrows the grid and offers the clear action', async () => {
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([
        makeCard({ cardIdentifier: 'R1', name: 'Red One', pitch: 1 }),
        makeCard({ cardIdentifier: 'B1', name: 'Blue One', pitch: 3 }),
      ]),
    });
    renderLibraryPage();
    await userEvent.click(screen.getByRole('checkbox', { name: /Vermelho pitch/ }));
    expect(screen.getAllByRole('listitem', { name: /Red One/ })).toHaveLength(1);
    expect(screen.queryByRole('listitem', { name: /Blue One/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /limpar todos os filtros/i })).toBeInTheDocument();
  });
});

describe('LibraryPage — group-by regroups without refetching (LIB-03)', () => {
  const CARDS = [
    makeCard({ cardIdentifier: 'R1', name: 'Red One', pitch: 1, types: ['Attack Action'], sets: ['WTR'] }),
    makeCard({ cardIdentifier: 'B1', name: 'Blue One', pitch: 3, types: ['Equipment'], sets: ['CRU'] }),
  ];

  beforeEach(() => {
    mockUseLibraryQuery.mockReset();
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse(CARDS),
    });
  });

  function groupHeadings(): string[] {
    return screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
  }

  it.each([
    ['Tipo', ['Attack Action', 'Equipment']],
    ['Pitch', ['Vermelho', 'Azul']],
    ['Set', ['CRU', 'WTR']],
    ['Lista', []],
  ] as const)('%s mode renders the matching group headings', async (label, expected) => {
    renderLibraryPage();
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(`^${label}$`) }));
    const headings = groupHeadings();
    for (const text of expected) {
      expect(headings.some((h) => h.includes(text))).toBe(true);
    }
    if (expected.length === 0) expect(headings).toEqual([]);
  });

  it('keeps the same cards on screen when the mode changes (no refetch needed)', async () => {
    const refetch = vi.fn();
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse(CARDS),
      refetch,
    });
    renderLibraryPage();
    await userEvent.click(screen.getByRole('radio', { name: /^Lista$/ }));
    expect(screen.getAllByRole('listitem', { name: /na coleção/ })).toHaveLength(2);
    expect(refetch).not.toHaveBeenCalled();
  });
});

describe('LibraryPage — card size (LIB-02)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockNavigate.mockClear();
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([makeCard()]),
    });
  });

  it('writes the chosen size to the URL and to localStorage', () => {
    renderLibraryPage();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '200' } });
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ cardSize: 200 }) }),
    );
    expect(window.localStorage.getItem('ra-library-card-size')).toBe('200');
  });

  it('drives the grid column width from the chosen size', () => {
    renderLibraryPage();
    const cellMin = (): string =>
      document.querySelector<HTMLElement>('ul[aria-label]:not([role])')!.style.getPropertyValue('--cell-min');
    expect(cellMin()).toBe('calc(120px + 1rem)');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '200' } });
    expect(cellMin()).toBe('calc(200px + 1rem)');
  });
});

describe('LibraryPage — quantity stepper survives (LIB-01, ruling 3.4)', () => {
  const MULTI = makeCard({
    cardIdentifier: 'M1',
    name: 'Multi Card',
    ownedQuantity: 3,
    contributions: [
      { sourceId: 's1', sourceLabel: 'Planilha', kind: 'csv', quantity: 2 },
      { sourceId: 's2', sourceLabel: 'Manual entries', kind: 'manual', quantity: 1 },
    ],
  });

  beforeEach(() => {
    mockDecrementMutate.mockReset();
    mockMutate.mockReset();
    mockUseLibraryQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeLibraryResponse([MULTI]),
    });
  });

  it('adds one copy from the cell', async () => {
    renderLibraryPage();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar um Multi Card' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ cardIdentifier: 'M1', quantity: 1 }),
    );
  });

  it('opens the source picker on remove when copies come from more than one source', async () => {
    renderLibraryPage();
    await userEvent.click(screen.getByRole('button', { name: 'Remover um Multi Card' }));
    expect(screen.getByRole('menu', { name: /Remover 1× de qual fonte/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Planilha/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Manual entries/ })).toBeInTheDocument();
    expect(mockDecrementMutate).not.toHaveBeenCalled();
  });
});

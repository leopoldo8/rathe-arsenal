import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ITrackedDeckListItem, TDeckStatus } from '../../../api/decks';
import { ToastProvider } from '../../../components/ui/Toast/ToastProvider';

const mockNavigate = vi.fn();
let mockSearch: { tag: string[] } = { tag: [] };

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (config: object) => ({ ...config, useSearch: () => mockSearch }),
    useNavigate: () => mockNavigate,
    Link: ({
      children,
      to,
      params,
      className,
      'aria-label': ariaLabel,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
      'aria-label'?: string;
      'data-testid'?: string;
    }) => (
      <a
        href={params ? to.replace('$deckId', params.deckId ?? '') : to}
        className={className}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {children}
      </a>
    ),
  };
});

const mockUseDecksQuery = vi.fn();
vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockUseDecksQuery(),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false, variables: null }),
}));

import { HomePage } from '../home';

function makeDeck(
  id: number,
  status: TDeckStatus,
  name: string,
  overrides: Partial<ITrackedDeckListItem> = {},
): ITrackedDeckListItem {
  return {
    id,
    fabraryUlid: null,
    name,
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '',
    updatedAt: '',
    status,
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: { rawPercent: 94, effectivePercent: 94, computedAt: '' },
    heroImageUrl: null,
    representativeCards: [],
    cardCounts: { owned: 63, missing: 4, total: 67 },
    ...overrides,
  };
}

function seed(decks: readonly ITrackedDeckListItem[], totalCardsMissing: number | null = 11): void {
  mockUseDecksQuery.mockReturnValue({
    isLoading: false,
    isError: false,
    data: {
      trackedDecks: decks,
      collectionCardCount: 40,
      totalCardsMissing,
      aggregateShoppingLine: null,
    },
  });
}

function renderHome(): void {
  render(
    <ToastProvider>
      <HomePage />
    </ToastProvider>,
  );
}

function group(name: string): HTMLElement {
  return screen.getByRole('heading', { name, level: 2 }).closest('section')!;
}

const ALL_STATUSES = [
  makeDeck(1, 'ready', 'Ready Deck', { tags: ['league'] }),
  makeDeck(2, 'active', 'Active Deck', { tags: ['casual'] }),
  makeDeck(3, 'building', 'Building Deck', { tags: ['league'] }),
  makeDeck(4, 'idea', 'Idea Deck', { latestSnapshot: null, cardCounts: null }),
  makeDeck(5, 'retired', 'Retired Deck'),
];

describe('Home route', () => {
  beforeEach(() => {
    mockSearch = { tag: [] };
    mockNavigate.mockReset();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders four groups with ready and active under one Ativos group (HOME-02, HOME-03)', () => {
    seed(ALL_STATUSES);
    renderHome();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Ativos', 'Construindo', 'Ideias', 'Aposentados']);
    expect(within(group('Ativos')).getByText('2 decks')).toBeInTheDocument();
    expect(within(group('Ativos')).getByLabelText('Ready Deck')).toBeInTheDocument();
    expect(within(group('Ativos')).getByLabelText('Active Deck')).toBeInTheDocument();
  });

  it('omits groups with no decks (HOME-04)', () => {
    seed([makeDeck(1, 'building', 'Only Building')]);
    renderHome();

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Construindo',
    ]);
  });

  it('derives the KPI strip from the data, excluding retired decks (HOME-01)', () => {
    seed(ALL_STATUSES, 11);
    renderHome();

    const strip = screen.getByRole('group', { name: /estatísticas da coleção/i });
    expect(within(strip).getByText('4')).toBeInTheDocument();
    expect(within(strip).getByText('94%')).toBeInTheDocument();
    expect(within(strip).getByText('11')).toBeInTheDocument();
  });

  it('shows all three meta line states on one page (HOME-06)', () => {
    seed([
      makeDeck(1, 'active', 'Done', {
        latestSnapshot: { rawPercent: 100, effectivePercent: 100, computedAt: '' },
        cardCounts: { owned: 67, missing: 0, total: 67 },
      }),
      makeDeck(2, 'building', 'Partial'),
      makeDeck(3, 'idea', 'Blank', { latestSnapshot: null, cardCounts: null }),
    ]);
    renderHome();

    expect(screen.getByText('Completo · 67/67')).toBeInTheDocument();
    expect(screen.getByText('4 faltando · 63/67')).toBeInTheDocument();
    expect(screen.getByText('Rascunho · sem lista')).toBeInTheDocument();
  });

  it('flags only the illegal deck with the legality marker', () => {
    seed([
      makeDeck(1, 'active', 'Legal'),
      makeDeck(2, 'active', 'Illegal', { legality: { category: 'illegal', reasons: ['x'] } }),
      makeDeck(3, 'active', 'Incomplete', { legality: { category: 'incomplete', reasons: ['x'] } }),
    ]);
    renderHome();

    expect(screen.getAllByTestId('legality-illegal')).toHaveLength(1);
  });

  it('filters the grid and the group counts as the search text changes (HOME-05)', () => {
    seed(ALL_STATUSES);
    renderHome();

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar decks/i }), {
      target: { value: 'ready' },
    });

    expect(within(group('Ativos')).getByText('1 deck')).toBeInTheDocument();
    expect(screen.queryByLabelText('Active Deck')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Construindo', level: 2 })).not.toBeInTheDocument();
  });

  it('ANDs the search with the active tag filter', () => {
    mockSearch = { tag: ['league'] };
    seed(ALL_STATUSES);
    renderHome();

    expect(screen.getByLabelText('Ready Deck')).toBeInTheDocument();
    expect(screen.getByLabelText('Building Deck')).toBeInTheDocument();
    expect(screen.queryByLabelText('Active Deck')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar decks/i }), {
      target: { value: 'building' },
    });

    expect(screen.queryByLabelText('Ready Deck')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Building Deck')).toBeInTheDocument();
  });

  it('writes tag changes to the url search param', () => {
    seed(ALL_STATUSES);
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: /filtrar por tag: casual/i }));

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/home',
      search: { tag: ['casual'] },
      replace: true,
    });
  });

  it('keeps the KPI strip on the unfiltered data while a search is active', () => {
    seed(ALL_STATUSES);
    renderHome();

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar decks/i }), {
      target: { value: 'ready' },
    });

    const strip = screen.getByRole('group', { name: /estatísticas da coleção/i });
    expect(within(strip).getByText('4')).toBeInTheDocument();
  });

  it('says so when the filters match nothing', () => {
    seed(ALL_STATUSES);
    renderHome();

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar decks/i }), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('Nenhum deck corresponde à busca ou aos filtros.')).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('does not show the all-retired block when a search hides the non-retired decks', () => {
    seed([makeDeck(1, 'active', 'Live'), makeDeck(2, 'retired', 'Gone')]);
    renderHome();

    fireEvent.change(screen.getByRole('searchbox', { name: /buscar decks/i }), {
      target: { value: 'gone' },
    });

    expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
  });

  it('shows the all-retired block when every tracked deck is retired', () => {
    seed([makeDeck(1, 'retired', 'Gone')]);
    renderHome();

    expect(screen.getByText(/todos os seus decks estão aposentados/i)).toBeInTheDocument();
  });

  it('shows the actionable empty state when there are no decks (HOME-07)', () => {
    seed([], null);
    renderHome();

    expect(screen.getByRole('link', { name: /rastrear seu primeiro deck|track your first deck/i })).toHaveAttribute(
      'href',
      '/decks/new',
    );
    expect(screen.queryByTestId('deckbox')).not.toBeInTheDocument();
  });

  it('renders the aggregate line inside the armory header, not after the groups', () => {
    mockUseDecksQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        trackedDecks: ALL_STATUSES,
        collectionCardCount: 40,
        totalCardsMissing: 11,
        aggregateShoppingLine: {
          storeName: 'Store',
          storeSlug: 'store',
          totalCostCents: 31200,
          completableDecks: 2,
          totalDecks: 4,
          kind: 'populated',
          uniqueCardsMissing: 5,
        },
      },
    });
    renderHome();

    const callout = screen.getByTestId('aggregate-callout');
    expect(screen.getByRole('heading', { level: 1 }).closest('header')).toContainElement(callout);
    expect(screen.getAllByTestId('aggregate-callout')).toHaveLength(1);
    const firstGroup = group('Ativos');
    expect(
      firstGroup.compareDocumentPosition(callout) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });
});

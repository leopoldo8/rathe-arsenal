/**
 * Deck detail route — states, the redesigned view-mode stack (DECK-01..09)
 * and the mutation Toast routing.
 *
 * View mode mounts the real banner, strip, analysis row, panels and decklist;
 * only data hooks, the router, CardArt (to observe how it is called) and the
 * heavy ShoppingPanel are stubbed. Edit mode keeps the layout shell.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  IBreakdownEntry,
  IDeckDetailResponse,
  IDeckDetailSnapshot,
} from '../../../api/deck-detail';
import type { ISwapRow } from '../../../api/swaps';
import { makeSwapRow } from '../../../test/swap-fixtures';
import swapStyles from '../../../components/deck-detail/SwapsPanel.module.css';
import stripStyles from '../../../components/deck-detail/DeckStatusStrip.module.css';
import listStyles from '../../../components/deck-detail/DeckList.module.css';
import viewStyles from '../../../components/deck-detail/DeckDetailView.module.css';
import bannerStyles from '../../../components/deck-detail/DeckHeroBanner.module.css';
import analysisStyles from '../../../components/deck-detail/DeckAnalysisRow.module.css';
import panelsStyles from '../../../components/deck-detail/DeckActionPanels.module.css';
import missingStyles from '../../../components/deck-detail/MissingPanel.module.css';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that use them
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockLink = vi.fn();
let mockEdit: 1 | undefined;

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (config: Record<string, unknown>) => ({
    useParams: () => ({ deckId: '1' }),
    useSearch: () => ({ edit: mockEdit }),
    component: config.component,
  }),
  Link: (props: {
    to: string;
    children: React.ReactNode;
    className?: string;
    'aria-label'?: string;
  }) => {
    mockLink(props);
    return (
      <a href={props.to} className={props.className} aria-label={props['aria-label']}>
        {props.children}
      </a>
    );
  },
  useNavigate: () => mockNavigate,
  useBlocker: vi.fn(),
}));

const mockPatchMutate = vi.fn();
const mockTagList = vi.hoisted(() => ({
  tags: [] as { id: number; name: string; createdAt: string }[],
}));
vi.mock('../../../api/tags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/tags')>();
  return { ...actual, useTagsQuery: () => ({ data: { tags: mockTagList.tags } }) };
});

const mockShowToast = vi.fn();
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

vi.mock('../../../components/deck-detail/DeckDetailSkeleton', () => ({
  DeckDetailSkeleton: () => (
    <div data-testid="deck-detail-skeleton" role="status" aria-busy="true" aria-label="Loading deck details" />
  ),
}));

vi.mock('../../../components/deck-detail/DeckDetailEmptyState', () => ({
  DeckDetailEmptyState: ({ kind }: { kind: string }) => (
    <div data-testid={`deck-empty-${kind}`}>{kind}</div>
  ),
}));

vi.mock('../../../components/deck-detail/ShoppingPanel', () => ({
  ShoppingPanel: () => <div data-testid="shopping-panel" />,
}));

vi.mock('../../../components/deck-detail/DeckDetailLayout', () => ({
  DeckDetailLayout: ({
    header,
    sidebar,
    canvas,
  }: {
    header: React.ReactNode;
    sidebar: React.ReactNode;
    canvas: React.ReactNode;
  }) => (
    <div data-testid="deck-detail-layout">
      <div data-testid="layout-header">{header}</div>
      <div data-testid="layout-sidebar">{sidebar}</div>
      <div data-testid="layout-canvas">{canvas}</div>
    </div>
  ),
}));

vi.mock('../../../components/deck-detail/DeckDetailHeader', () => ({
  DeckDetailHeader: () => <div data-testid="deck-detail-header" />,
}));

vi.mock('../../../components/deck-detail/DeckDetailSidebar', () => ({
  DeckDetailSidebar: () => <div data-testid="deck-detail-sidebar" />,
}));

vi.mock('../../../components/deck-detail/DeckCanvas', () => ({
  DeckCanvas: () => <div data-testid="deck-canvas" />,
}));

const mockCardArt = vi.fn();
vi.mock('../../../components/card-art/CardArt', () => ({
  CardArt: (props: { name: string; missingCount?: number; missing: boolean }) => {
    mockCardArt(props);
    return (
      <div
        data-testid="card-art-stub"
        data-name={props.name}
        data-missing-count={props.missingCount ?? 0}
        data-missing={props.missing}
      />
    );
  },
}));

vi.mock('../../../components/card-art/CardLightbox', () => ({
  CardLightbox: () => <div data-testid="card-lightbox" />,
}));

vi.mock('../../../api/catalog', () => ({
  useHeroesQuery: () => ({
    data: {
      heroes: [
        {
          cardIdentifier: 'dorinthea-ironsong-wtr',
          name: 'Dorinthea Ironsong',
          hero: 'Dorinthea',
          young: false,
          legalFormats: [],
          imageUrl: {
            small: 'hero-small.jpg',
            large: 'hero-large.jpg',
            sources: [{ small: 'hero-small.jpg', large: 'hero-large.jpg' }],
          },
        },
      ],
    },
    isLoading: false,
    isFetching: false,
  }),
  HEROES_QUERY_KEY: ['catalog-heroes'],
}));

vi.mock('../../../api/decks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/decks')>();
  return {
    ...actual,
    usePatchDeckMutation: () => ({ mutate: mockPatchMutate, isPending: false }),
    useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
    usePutDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

// ---------------------------------------------------------------------------
// API mock state — mutable so each test can configure it
// ---------------------------------------------------------------------------

type TQueryState =
  | 'loading'
  | 'error'
  | 'success-null'
  | 'success-no-snapshot'
  | 'success-populated';

let mockQueryState: TQueryState = 'loading';
let mockDeckData: IDeckDetailResponse | null | undefined;

const mockSwapMutate = vi.fn();
const mockRefetchSwaps = vi.fn();
let mockSwapsLoaded = true;
const mockMarkOwnedMutate = vi.fn();
const mockClearRejectionsMutate = vi.fn();
let mockSwapRows: ISwapRow[] = [];
const mockVariantMutate = vi.fn();
const mockRefetch = vi.fn();

vi.mock('../../../api/deck-detail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/deck-detail')>();
  return {
    ...actual,
    useDeckDetailQuery: () => ({
      isLoading: mockQueryState === 'loading',
      isError: mockQueryState === 'error',
      error: mockQueryState === 'error' ? new Error('Network failure') : null,
      data: mockQueryState.startsWith('success') ? mockDeckData : undefined,
      refetch: mockRefetch,
    }),
    useMarkOwnedMutation: () => ({
      mutate: mockMarkOwnedMutate,
      isPending: false,
      isError: false,
      variables: null,
    }),
  };
});

vi.mock('../../../api/swaps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/swaps')>();
  return {
    ...actual,
    useSwapsQuery: () => ({
      data: mockSwapsLoaded ? { rows: mockSwapRows } : undefined,
      refetch: mockRefetchSwaps,
    }),
    useSwapMutation: () => ({
      mutate: mockSwapMutate,
      isPending: false,
      variables: null,
    }),
    useRestoreRejectedSwaps: () => ({
      mutate: mockClearRejectionsMutate,
      isPending: false,
    }),
  };
});

vi.mock('../../../api/variant-fetch', () => ({
  useVariantFetchMutation: () => ({
    mutate: mockVariantMutate,
    status: 'idle',
    isSuccess: false,
    data: null,
  }),
}));

vi.mock('../../../api/variant-jobs', () => ({
  useVariantJobsQuery: () => ({
    data: { jobs: [], etaSeconds: 0 },
    isLoading: false,
    isError: false,
  }),
  VARIANT_JOBS_QUERY_KEY: ['variant-jobs'],
  hasActiveJobs: (data: { jobs: unknown[] }) => data.jobs.length > 0,
}));

// ---------------------------------------------------------------------------
// The route component — imported after all mocks
// ---------------------------------------------------------------------------

import { Route } from '../../../routes/_auth/decks.$deckId';

function renderPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = (Route as any).component as React.FC;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function entry(overrides: Partial<IBreakdownEntry> = {}): IBreakdownEntry {
  return {
    cardIdentifier: 'card-a',
    name: 'Card A',
    quantity: 1,
    slot: 'mainboard',
    pitch: 1,
    cost: 1,
    type: 'Action',
    imageUrl: null,
    ...overrides,
  };
}

function swapEntry(original: Partial<IBreakdownEntry>, substituteId: string, score: number) {
  return {
    original: entry(original),
    match: {
      substitute: {
        cardIdentifier: substituteId,
        name: `Sub ${substituteId}`,
        classes: [],
        pitch: null,
        power: null,
        defense: null,
        keywords: [],
        imageUrl: null,
      },
      tier: 1,
      score,
      rationale: '',
    },
  };
}

function swapRowFor(
  originalId: string,
  substituteId: string,
  status: ISwapRow['status'],
  overrides: Partial<ISwapRow> = {},
): ISwapRow {
  return makeSwapRow({
    id: `swap-${originalId}-${substituteId}`,
    trackedDeckId: 1,
    cardIdentifier: originalId,
    slot: 'mainboard',
    substituteIdentifier: substituteId,
    status,
    ...overrides,
  });
}

// Pairwise-distinct values so a swapped prop fails an assertion.
const RAW = 61.2;
const FIDELITY = 83.4;
const PCT = 72;

function buildSnapshot(overrides: Partial<IDeckDetailSnapshot> = {}): IDeckDetailSnapshot {
  return {
    id: 1,
    rawPercent: RAW,
    effectivePercent: PCT,
    path: 'C',
    fidelityPercent: FIDELITY,
    breakdown: {
      exact: [entry({ cardIdentifier: 'owned-1', name: 'Owned One', quantity: 2, pitch: 3, cost: 0 })],
      substituted: [],
      missing: [entry({ cardIdentifier: 'gap-1', name: 'Gap One', quantity: 3 })],
      notOwned: [entry({ cardIdentifier: 'gap-1', name: 'Gap One', quantity: 3 })],
    },
    computedAt: '2026-04-27T00:00:00Z',
    ...overrides,
  };
}

function buildDeck(overrides: Partial<IDeckDetailResponse> = {}): IDeckDetailResponse {
  return {
    id: 1,
    fabraryUlid: 'abc123',
    name: 'Dorinthea Deck',
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong-wtr',
    format: 'Classic Constructed',
    trackedAt: '2026-04-27T00:00:00Z',
    updatedAt: '2026-04-27T00:00:00Z',
    status: 'active',
    tags: ['liga local'],
    notes: null,
    legality: { category: 'legal', reasons: [] },
    totalCards: 60,
    latestSnapshot: buildSnapshot(),
    ...overrides,
  };
}

function populate(deck: IDeckDetailResponse): void {
  mockQueryState = 'success-populated';
  mockDeckData = deck;
}

function completeDeck(): IDeckDetailResponse {
  return buildDeck({
    latestSnapshot: buildSnapshot({
      effectivePercent: 100,
      path: 'A',
      breakdown: {
        exact: [entry({ cardIdentifier: 'owned-1', name: 'Owned One', quantity: 4 })],
        substituted: [],
        missing: [],
        notOwned: [],
      },
    }),
  });
}

function solvableDeck(): IDeckDetailResponse {
  const swaps = [
    swapEntry({ cardIdentifier: 'gap-a', name: 'Gap A', quantity: 2 }, 'sub-a', 0.92),
    swapEntry({ cardIdentifier: 'gap-b', name: 'Gap B', quantity: 1 }, 'sub-b', 0.89),
  ];
  return buildDeck({
    latestSnapshot: buildSnapshot({
      effectivePercent: 78,
      path: 'B',
      breakdown: {
        exact: [],
        substituted: swaps,
        missing: [],
        notOwned: swaps.map((s) => s.original),
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryState = 'loading';
  mockDeckData = undefined;
  mockEdit = undefined;
  mockTagList.tags = [];
  mockSwapRows = [];
  mockSwapsLoaded = true;
});

describe('DeckDetailPage — loading state', () => {
  it('renders the skeleton while the query is pending', () => {
    mockQueryState = 'loading';
    renderPage();
    expect(screen.getByTestId('deck-detail-skeleton')).toBeInTheDocument();
  });
});

describe('DeckDetailPage — not-found state', () => {
  it('renders the not-found empty state when deck data is null', () => {
    mockQueryState = 'success-null';
    mockDeckData = null;
    renderPage();
    expect(screen.getByTestId('deck-empty-not-found')).toBeInTheDocument();
  });
});

describe('DeckDetailPage — computing state', () => {
  it('renders the computing empty state when latestSnapshot is null', () => {
    mockQueryState = 'success-no-snapshot';
    mockDeckData = buildDeck({ latestSnapshot: null });
    renderPage();
    expect(screen.getByTestId('deck-empty-computing')).toBeInTheDocument();
  });
});

describe('DeckDetailPage — view mode layout', () => {
  it('renders the single-column stack instead of the header/sidebar/canvas shell', () => {
    populate(buildDeck());
    renderPage();

    expect(screen.getByTestId('deck-detail-view')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-detail-layout')).toBeNull();
    expect(screen.queryByTestId('deck-detail-sidebar')).toBeNull();
  });

  it('keeps the shell in composition-edit mode, without the readiness medallion', () => {
    mockEdit = 1;
    populate(buildDeck());
    renderPage();

    expect(screen.getByTestId('deck-detail-layout')).toBeInTheDocument();
    expect(screen.getByTestId('deck-detail-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('deck-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('readiness-medallion')).toBeNull();
    expect(screen.queryByTestId('deck-status-strip')).toBeNull();
  });
});

describe('DeckDetailPage — rendered elements carry the classes the layout rules key on', () => {
  it('puts the stack, banner, analysis row, panels and list grid on their rules', () => {
    populate(buildDeck());
    renderPage();

    expect(screen.getByTestId('deck-detail-view')).toHaveClass(viewStyles.stack!);
    expect(screen.getByTestId('deck-hero-banner')).toHaveClass(bannerStyles.banner!);
    expect(screen.getByTestId('deck-hero-eyebrow')).toHaveClass(bannerStyles.eyebrow!);
    expect(screen.getByTestId('deck-analysis-row')).toHaveClass(analysisStyles.row!);
    expect(screen.getByTestId('deck-action-panels')).toHaveClass(panelsStyles.row!);
    expect(screen.getAllByTestId('deck-list-cell')[0]!.parentElement).toHaveClass(listStyles.grid!);
    expect(screen.getAllByTestId('deck-list-cell')[0]!.firstElementChild).toHaveClass(listStyles.thumb!);
  });

  it('colours the missing-row pitch bar by the card pitch', () => {
    populate(buildDeck());
    renderPage();

    expect(screen.getByTestId('missing-row').firstElementChild).toHaveClass(missingStyles.pitchBar!);
    expect(screen.getByTestId('missing-row').firstElementChild).toHaveClass(missingStyles.pitchRed!);
  });
});

describe('DeckDetailPage — hero banner (DECK-01)', () => {
  beforeEach(() => populate(buildDeck()));

  it('shows the title, the hero name and the format-and-league eyebrow', () => {
    renderPage();

    const banner = screen.getByTestId('deck-hero-banner');
    expect(within(banner).getByRole('heading', { level: 1, name: 'Dorinthea Deck' })).toBeInTheDocument();
    expect(screen.getByTestId('deck-hero-name')).toHaveTextContent('Dorinthea Ironsong');
    expect(screen.getByTestId('deck-hero-eyebrow')).toHaveTextContent('Classic Constructed · liga local');
  });

  it('draws the hero art behind the banner', () => {
    renderPage();

    expect(screen.getByTestId('deck-hero-banner-art')).toHaveAttribute('src', 'hero-small.jpg');
  });

  it('shows the 90px medallion with the gated percent, inside the banner', () => {
    renderPage();

    const medallion = within(screen.getByTestId('deck-hero-banner')).getByTestId('readiness-medallion');
    expect(medallion).toHaveAttribute('data-size', 'lg');
    expect(medallion).toHaveAttribute('aria-valuenow', String(PCT));
  });

  it('shows the status chip and the Edit action', () => {
    renderPage();

    const bar = screen.getByTestId('deck-detail-action-bar');
    expect(within(bar).getByRole('combobox')).toBeInTheDocument();
    expect(within(bar).getByTestId('deck-detail-edit-btn')).toBeInTheDocument();
  });

  it('opens the Edit deck screen from the hero Edit button, not composition editing', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('deck-detail-edit-btn'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/decks/$deckId/edit',
      params: { deckId: '1' },
    });
  });

  it('opens composition editing from Edit cards in the decklist header', async () => {
    renderPage();

    const header = screen.getByTestId('deck-list');
    await userEvent.click(within(header).getByTestId('deck-list-edit-cards-btn'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/decks/$deckId',
      params: { deckId: '1' },
      search: { edit: 1 },
    });
  });

  it('keeps Edit cards beside the view toggle, not in the hero banner', () => {
    renderPage();

    const button = screen.getByTestId('deck-list-edit-cards-btn');
    expect(button).toHaveTextContent('Editar cartas');
    expect(button).toHaveClass(listStyles.editCardsBtn as string);
    expect(within(screen.getByTestId('deck-hero-banner')).queryByTestId('deck-list-edit-cards-btn')).toBeNull();
    expect(button.parentElement).toContainElement(screen.getByTestId('deck-list-view-type'));
  });

  it('keeps Untrack reachable through the overflow menu', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('deck-detail-overflow-btn'));

    expect(screen.getByTestId('deck-detail-untrack-btn')).toBeInTheDocument();
  });

  it('removes a tag by its real id, not by its position in the row', async () => {
    mockTagList.tags = [
      { id: 7, name: 'aggro', createdAt: '' },
      { id: 42, name: 'liga local', createdAt: '' },
    ];
    populate(buildDeck({ tags: ['liga local'] }));
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /liga local/i }));

    expect(mockPatchMutate).toHaveBeenCalledWith({ removeTagIds: [42] });
  });

  it('shows the eyebrow with the format alone when the deck has no tag', () => {
    populate(buildDeck({ tags: [] }));
    renderPage();

    expect(screen.getByTestId('deck-hero-eyebrow')).toHaveTextContent(/^Classic Constructed$/);
  });
});

describe('DeckDetailPage — status strip (DECK-02, DECK-03)', () => {
  it('renders the incomplete tone with the gap, the swaps link and one Fabrary link', () => {
    populate(buildDeck());
    renderPage();

    const strip = screen.getByTestId('deck-status-strip');
    expect(strip).toHaveAttribute('data-kind', 'incomplete');
    expect(strip).toHaveClass(stripStyles.toneIncomplete!);
    expect(screen.getByTestId('deck-status-strip-message')).toHaveTextContent(
      'Faltam 3 cartas em 1 slot — nenhuma troca disponível.',
    );
    expect(screen.getByTestId('strip-view-shopping')).toBeInTheDocument();
  });

  it('renders the complete tone with no actions when pct is 100', () => {
    populate(completeDeck());
    renderPage();

    const strip = screen.getByTestId('deck-status-strip');
    expect(strip).toHaveAttribute('data-kind', 'complete');
    expect(strip).toHaveClass(stripStyles.toneComplete!);
    expect(within(strip).queryByRole('link')).toBeNull();
  });

  it('says the deck is solvable, pending approval, when Path is B but pct is below 100', () => {
    populate(solvableDeck());
    renderPage();

    const strip = screen.getByTestId('deck-status-strip');
    expect(strip).toHaveAttribute('data-kind', 'solvable');
    expect(strip).toHaveClass(stripStyles.toneSolvable!);
    expect(screen.getByTestId('deck-status-strip-message')).toHaveTextContent(
      'Sua coleção cobre esse deck — 2 trocas aguardando aprovação para chegar a 100%.',
    );
    expect(screen.getByTestId('deck-hero-banner')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('deck-hero-banner')).getByTestId('readiness-medallion'),
    ).toHaveAttribute('aria-valuenow', '78');
  });

  it('reads as complete once the approved swaps cover every gap and pct reaches 100', () => {
    const deck = solvableDeck();
    mockSwapRows = [swapRowFor('gap-a', 'sub-a', 'approved'), swapRowFor('gap-b', 'sub-b', 'approved')];
    populate({
      ...deck,
      latestSnapshot: { ...deck.latestSnapshot!, effectivePercent: 100 },
    });
    renderPage();

    expect(screen.getByTestId('deck-status-strip')).toHaveAttribute('data-kind', 'complete');
    expect(screen.queryByTestId('deck-action-panels')).toBeNull();
  });

  it('routes "Ver trocas" through the router Link to /swaps', () => {
    populate(solvableDeck());
    renderPage();

    expect(mockLink).toHaveBeenCalledWith(expect.objectContaining({ to: '/swaps' }));
    expect(screen.getAllByRole('link', { name: 'Ver trocas' }).length).toBeGreaterThan(0);
  });
});

describe('DeckDetailPage — Fabrary link appears once (DECK-09)', () => {
  const fabraryLinks = (): HTMLElement[] =>
    screen.queryAllByRole('link').filter((a) => a.getAttribute('href')?.includes('fabrary.com'));

  it('renders exactly one Fabrary link on an incomplete deck', () => {
    populate(buildDeck());
    renderPage();

    expect(fabraryLinks()).toHaveLength(1);
    expect(within(screen.getByTestId('deck-status-strip')).getByTestId('deck-fabrary-link')).toBeInTheDocument();
  });

  it('renders none on a complete deck', () => {
    populate(completeDeck());
    renderPage();

    expect(fabraryLinks()).toHaveLength(0);
  });

  it('renders none for a deck imported without a Fabrary id', () => {
    populate(buildDeck({ fabraryUlid: null }));
    renderPage();

    expect(fabraryLinks()).toHaveLength(0);
  });
});

describe('DeckDetailPage — analysis row (DECK-04)', () => {
  beforeEach(() => populate(buildDeck()));

  it('renders raw, fidelity and pct as three separate values', () => {
    renderPage();

    expect(screen.getByTestId('analysis-raw-value')).toHaveTextContent('61.2%');
    expect(screen.getByTestId('analysis-fidelity-value')).toHaveTextContent('83.4%');
    expect(screen.getByTestId('readiness-medallion')).toHaveAttribute('aria-valuenow', '72');
  });

  it('never concatenates raw and fidelity into one string', () => {
    renderPage();

    expect(screen.queryAllByText(/61\.2.*83\.4/)).toHaveLength(0);
    expect(screen.queryByText(/Bruto/)).toBeNull();
    expect(screen.queryByText(/Fidelity.*·/)).toBeNull();
    expect(screen.getByTestId('analysis-raw-value').textContent).not.toContain('83.4');
    expect(screen.getByTestId('analysis-fidelity-value').textContent).not.toContain('61.2');
  });

  it('explains that fidelity is what can be solved, not what is approved', () => {
    renderPage();

    expect(
      within(screen.getByTestId('analysis-readiness')).getByText(
        'A fidelidade mostra o que dá para resolver, não o que já foi aprovado.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the legality badge in the readiness card', () => {
    renderPage();

    expect(within(screen.getByTestId('analysis-readiness')).getByTestId('legality-badge')).toBeInTheDocument();
  });

  it('renders the pitch distribution and the cost curve cards', () => {
    renderPage();

    expect(within(screen.getByTestId('analysis-pitch')).getByTestId('pitch-legend-3')).toHaveTextContent('Azul 2');
    expect(within(screen.getByTestId('analysis-cost')).getByTestId('cost-bar-0')).toHaveTextContent('2');
  });
});

describe('DeckDetailPage — missing and swaps panels (DECK-05)', () => {
  it('renders both panels while the deck is incomplete', () => {
    populate(buildDeck());
    renderPage();

    expect(screen.getByTestId('deck-missing-panel')).toBeInTheDocument();
    expect(screen.getByTestId('deck-swaps-panel')).toBeInTheDocument();
  });

  it('omits both panels when the deck is complete', () => {
    populate(completeDeck());
    renderPage();

    expect(screen.queryByTestId('deck-missing-panel')).toBeNull();
    expect(screen.queryByTestId('deck-swaps-panel')).toBeNull();
  });

  it('gives the missing panel the id the strip anchor points at', () => {
    populate(buildDeck());
    renderPage();

    const anchor = screen.getByTestId('strip-view-shopping');
    expect(anchor).toHaveAttribute('href', '#deck-missing-panel');
    expect(screen.getByTestId('deck-missing-panel')).toHaveAttribute('id', 'deck-missing-panel');
  });

  it('lists the cards still to buy with their missing count', () => {
    populate(buildDeck());
    renderPage();

    const row = within(screen.getByTestId('deck-missing-panel')).getByTestId('missing-row');
    expect(row).toHaveTextContent('Gap One');
    expect(row).toHaveTextContent('falta ×3');
  });

  it('links Comprar to the store product page when the shopping line has one', () => {
    populate(
      buildDeck({
        shoppingLine: {
          kind: 'populated',
          storeName: 'Loja',
          storeHostname: 'loja.example',
          totalCostCents: 1000,
          availableCardCount: 1,
          unavailableCardCount: 0,
          lastFetchedAt: '2026-04-27T00:00:00Z',
          lines: [
            {
              cardIdentifier: 'gap-1',
              cardName: 'Gap One',
              quantityNeeded: 3,
              quantityAvailable: 3,
              unitPriceCents: 333,
              productUrl: 'https://loja.example/gap-one',
              lastFetchedAt: '2026-04-27T00:00:00Z',
            },
          ],
        },
      }),
    );
    renderPage();

    expect(screen.getByRole('link', { name: 'Comprar Gap One na loja' })).toHaveAttribute(
      'href',
      'https://loja.example/gap-one',
    );
  });

  it('shows no Comprar link for a card the store does not list', () => {
    populate(buildDeck());
    renderPage();

    expect(screen.queryByRole('link', { name: /Comprar/ })).toBeNull();
  });

  it('says nothing is left to buy when swaps cover every gap', () => {
    mockSwapRows = [swapRowFor('gap-a', 'sub-a', 'approved'), swapRowFor('gap-b', 'sub-b', 'approved')];
    populate({
      ...solvableDeck(),
      latestSnapshot: { ...solvableDeck().latestSnapshot!, effectivePercent: 90 },
    });
    renderPage();

    expect(screen.queryByTestId('missing-row')).toBeNull();
    expect(screen.getByTestId('deck-missing-panel')).toHaveTextContent('Nada a comprar');
  });
});

describe('DeckDetailPage — swap confidence bands come from score', () => {
  function bandedDeck(scores: readonly number[]): IDeckDetailResponse {
    const swaps = scores.map((score, index) =>
      swapEntry({ cardIdentifier: `gap-${index}`, name: `Gap ${index}` }, `sub-${index}`, score),
    );
    return buildDeck({
      latestSnapshot: buildSnapshot({
        path: 'B',
        breakdown: { exact: [], substituted: swaps, missing: [], notOwned: swaps.map((s) => s.original) },
      }),
    });
  }

  it.each([
    [0.9, '90%', 'high', swapStyles.bandHigh],
    [0.89, '89%', 'mid', swapStyles.bandMid],
    [0.7, '70%', 'mid', swapStyles.bandMid],
    [0.69, '69%', 'low', swapStyles.bandLow],
  ])('score %s renders %s in the %s band', (score, label, band, bandClass) => {
    populate(bandedDeck([score]));
    renderPage();

    const confidence = screen.getByTestId('swap-confidence');
    expect(confidence).toHaveTextContent(`${label} confiança`);
    expect(confidence).toHaveAttribute('data-band', band);
    expect(confidence).toHaveClass(bandClass!);
  });

  it('renders the covered quantity next to the confidence', () => {
    populate(solvableDeck());
    renderPage();

    expect(screen.getAllByTestId('swap-confidence')[0]).toHaveTextContent('Cobre ×2 · 92% confiança');
  });

  it('shows the empty state when there is no swap to suggest', () => {
    populate(buildDeck());
    renderPage();

    expect(screen.getByTestId('deck-swaps-panel')).toHaveTextContent('Nenhuma troca sugerida.');
  });
});

describe('DeckDetailPage — swap actions go through the swaps API', () => {
  beforeEach(() => {
    populate(solvableDeck());
    mockSwapRows = [swapRowFor('gap-a', 'sub-a', 'pending'), swapRowFor('gap-b', 'sub-b', 'pending')];
  });

  it('approves by the id of the swap that matches card, slot and substitute', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar troca de Gap A por Sub sub-a' }));

    expect(mockSwapMutate).toHaveBeenCalledWith(
      { swapId: 'swap-gap-a-sub-a', action: { kind: 'approve' } },
      expect.any(Object),
    );
  });

  it('rejects by swap id, never by substitute identifier', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Recusar troca de Gap B por Sub sub-b' }));

    expect(mockSwapMutate).toHaveBeenCalledWith(
      { swapId: 'swap-gap-b-sub-b', action: { kind: 'reject' } },
      expect.any(Object),
    );
  });

  it('keeps the same substitute in another slot out of the match', async () => {
    mockSwapRows = [
      swapRowFor('gap-a', 'sub-a', 'pending', { id: 'other-slot', slot: 'equipment' }),
      swapRowFor('gap-a', 'sub-a', 'pending', { id: 'right-slot', slot: 'mainboard' }),
      swapRowFor('gap-b', 'sub-b', 'pending'),
    ];
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar troca de Gap A por Sub sub-a' }));

    expect(mockSwapMutate).toHaveBeenCalledWith(
      { swapId: 'right-slot', action: { kind: 'approve' } },
      expect.any(Object),
    );
  });

  it('offers Undo on an approved swap and reverts it by swap id', async () => {
    const deck = solvableDeck();
    mockSwapRows = [swapRowFor('gap-a', 'sub-a', 'approved'), swapRowFor('gap-b', 'sub-b', 'pending')];
    populate({ ...deck, latestSnapshot: { ...deck.latestSnapshot!, effectivePercent: 90, path: 'C' } });
    renderPage();

    expect(
      screen.queryByRole('button', { name: 'Aprovar troca de Gap A por Sub sub-a' }),
    ).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer troca de Gap A por Sub sub-a' }));

    expect(mockSwapMutate).toHaveBeenCalledWith(
      { swapId: 'swap-gap-a-sub-a', action: { kind: 'revert' } },
      expect.any(Object),
    );
  });

  it('disables the buttons until the swaps list has the matching swap', () => {
    mockSwapRows = [];
    renderPage();

    expect(screen.getByRole('button', { name: 'Aprovar troca de Gap A por Sub sub-a' })).toBeDisabled();
  });

  it('toasts when a swap action fails', async () => {
    mockSwapMutate.mockImplementation((_vars: unknown, options?: { onError?: (e: Error) => void }) => {
      options?.onError?.(new Error('boom'));
    });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Aprovar troca de Gap A por Sub sub-a' }));

    expect(mockShowToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Não foi possível salvar a troca. Tente de novo.',
    });
  });
});

describe('DeckDetailPage — decklist (DECK-06, DECK-07, DECK-08)', () => {
  const partialDeck = (): IDeckDetailResponse =>
    buildDeck({
      latestSnapshot: buildSnapshot({
        breakdown: {
          exact: [
            entry({ cardIdentifier: 'p', name: 'Partial', quantity: 1, type: 'Action' }),
            entry({ cardIdentifier: 'full', name: 'Full Set', quantity: 2, type: 'Defense Reaction', cost: 2 }),
          ],
          substituted: [],
          missing: [entry({ cardIdentifier: 'p', name: 'Partial', quantity: 2, type: 'Action' })],
          notOwned: [entry({ cardIdentifier: 'p', name: 'Partial', quantity: 2, type: 'Action' })],
        },
      }),
    });

  const cellFor = (name: string): HTMLElement =>
    screen
      .getAllByTestId('deck-list-cell')
      .find((cell) => cell.textContent?.includes(name)) as HTMLElement;

  it('shows one tile per card with the quantity badge and the missing badge', () => {
    populate(partialDeck());
    renderPage();

    const cell = cellFor('Partial');
    expect(within(cell).getByTestId('deck-list-qty')).toHaveTextContent('×3');
    expect(within(cell).getByTestId('card-art-stub')).toHaveAttribute('data-missing-count', '2');
    expect(screen.getAllByTestId('deck-list-cell').filter((c) => c.textContent?.includes('Partial'))).toHaveLength(1);
  });

  it('gives a card with missing copies the miss border and a complete card none', () => {
    populate(partialDeck());
    renderPage();

    expect(cellFor('Partial')).toHaveClass(listStyles.cellMissing!);
    expect(cellFor('Full Set')).not.toHaveClass(listStyles.cellMissing!);
    expect(within(cellFor('Full Set')).getByTestId('card-art-stub')).toHaveAttribute('data-missing-count', '0');
  });

  it('renders every thumbnail through CardArt, passing the missing count', () => {
    populate(partialDeck());
    renderPage();

    const partialCall = mockCardArt.mock.calls.map(([props]) => props).find((p) => p.name === 'Partial');
    expect(partialCall).toMatchObject({ missingCount: 2, missing: false });
    expect(mockCardArt.mock.calls.map(([props]) => props.name)).toEqual(
      expect.arrayContaining(['Partial', 'Full Set']),
    );
  });

  it('starts grouped by type', () => {
    populate(partialDeck());
    renderPage();

    expect(screen.getByTestId('deck-list-group-attack')).toBeInTheDocument();
    expect(screen.getByTestId('deck-list-group-defense')).toBeInTheDocument();
    expect(screen.getByTestId('deck-list-view-type')).toHaveAttribute('aria-pressed', 'true');
  });

  it('regroups by cost and by list without refetching', async () => {
    populate(partialDeck());
    renderPage();

    await userEvent.click(screen.getByTestId('deck-list-view-cost'));
    expect(screen.getByTestId('deck-list-group-1')).toBeInTheDocument();
    expect(screen.getByTestId('deck-list-group-2')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-list-group-attack')).toBeNull();
    expect(screen.getByTestId('deck-list-view-cost')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('deck-list-view-type')).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByTestId('deck-list-view-list'));
    expect(screen.getByTestId('deck-list-group-all')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-list-group-2')).toBeNull();

    expect(mockRefetch).not.toHaveBeenCalled();
  });
});

describe('DeckDetailPage — swaps list not loaded yet', () => {
  it('keeps an applied swap counted as applied, from the engine flag, while the list loads', () => {
    const deck = solvableDeck();
    const swaps = deck.latestSnapshot!.breakdown.substituted.map((entry, index) =>
      index === 0 ? { ...entry, approved: true } : entry,
    );
    mockSwapsLoaded = false;
    populate({
      ...deck,
      latestSnapshot: {
        ...deck.latestSnapshot!,
        breakdown: { ...deck.latestSnapshot!.breakdown, substituted: swaps },
      },
    });
    renderPage();

    expect(screen.getByRole('button', { name: 'Desfazer troca de Gap A por Sub sub-a' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Aprovar troca de Gap B por Sub sub-b' })).toBeDisabled();
  });

  it('refetches the swaps list when a snapshot arrives', () => {
    populate(solvableDeck());
    renderPage();

    expect(mockRefetchSwaps).toHaveBeenCalledTimes(1);
  });

  it('does not refetch while the deck has no snapshot yet', () => {
    populate(buildDeck({ latestSnapshot: null }));
    renderPage();

    expect(mockRefetchSwaps).not.toHaveBeenCalled();
  });
});

describe('DeckDetailPage — rejected swaps banner', () => {
  it('counts the rejected swaps from the swaps list', () => {
    populate(buildDeck());
    mockSwapRows = [swapRowFor('a', 's1', 'rejected'), swapRowFor('b', 's2', 'rejected')];
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('2');
  });

  it('shows no banner when no swap of this deck is rejected', () => {
    populate(buildDeck());
    mockSwapRows = [swapRowFor('a', 's1', 'pending'), swapRowFor('b', 's2', 'rejected', { trackedDeckId: 99 })];
    renderPage();

    expect(screen.queryByRole('button', { name: /Limpar rejeições/ })).toBeNull();
  });

  it('restores only the rejected swaps of this deck when clearing', async () => {
    populate(buildDeck());
    const mine = swapRowFor('a', 's1', 'rejected');
    mockSwapRows = [
      mine,
      swapRowFor('b', 's2', 'approved'),
      swapRowFor('c', 's3', 'rejected', { trackedDeckId: 99 }),
    ];
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Limpar rejeições/ }));

    expect(mockClearRejectionsMutate).toHaveBeenCalledWith([mine], expect.any(Object));
  });
});

describe('DeckDetailPage — mutation Toast routing', () => {
  it('routes clearRejections error through Toast when mutation fails', async () => {
    populate(buildDeck());
    mockSwapRows = [swapRowFor('gap-1', 'sub-1', 'rejected')];
    mockClearRejectionsMutate.mockImplementation(
      (_vars: unknown, options?: { onError?: (err: Error) => void }) => {
        options?.onError?.(new Error('Server error'));
      },
    );

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Limpar rejeições/ }));

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('Falha ao limpar rejeições'),
      }),
    );
  });

  it('clearRejections Toast payload includes a retry callback', async () => {
    populate(buildDeck());
    mockSwapRows = [swapRowFor('gap-1', 'sub-1', 'rejected')];
    mockClearRejectionsMutate.mockImplementation(
      (_vars: unknown, options?: { onError?: (err: Error) => void }) => {
        options?.onError?.(new Error('Server error'));
      },
    );

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Limpar rejeições/ }));

    const call = mockShowToast.mock.calls[0]?.[0] as { retry?: () => void } | undefined;
    expect(typeof call?.retry).toBe('function');
  });

  it('marks a missing card as owned through the mutation with its identifier', async () => {
    populate(buildDeck());
    renderPage();

    await userEvent.click(
      within(screen.getByTestId('missing-row')).getByRole('button', { name: 'Marcar como possuída' }),
    );

    expect(mockMarkOwnedMutate).toHaveBeenCalledWith('gap-1', expect.any(Object));
  });

  it('routes a markOwned failure through Toast', async () => {
    populate(buildDeck());
    mockMarkOwnedMutate.mockImplementation(
      (_cardId: unknown, options?: { onError?: (err: Error) => void }) => {
        options?.onError?.(new Error('Mark owned failed'));
      },
    );

    renderPage();
    await userEvent.click(
      within(screen.getByTestId('missing-row')).getByRole('button', { name: 'Marcar como possuída' }),
    );

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('Falha ao marcar carta: Mark owned failed'),
      }),
    );
  });
});

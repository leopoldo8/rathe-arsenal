/**
 * OnboardingWizard test suite — Unit 14
 *
 * Covers:
 *  - Happy path: fresh user flows through step 1 → step 2 → step 3 → /home
 *  - Happy path (skip): clicking Skip on step 2 routes to /home
 *  - Edge case (invalid URL): step 1 shows format error immediately
 *  - Edge case (unreachable URL): step 1 shows unreachable copy after timeout
 *  - Edge case (private deck): step 1 shows private-deck copy from backend error
 *  - Edge case (100% readiness): step 3 renders <CongratsAllPlayable>
 *  - Edge case (10s computation timeout): step 3 shows "Continue without review"
 *  - Integration (R60 guard): user with tracked decks is redirected to /decks/new
 *  - A11y: step indicator announces progress via aria-label
 */

import React from 'react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../../../lib/api-client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// TanStack Router
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => undefined,
  Navigate: ({ to }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  ),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

// API: decks
const mockUseDecksQuery = vi.fn();
const mockImportMutateAsync = vi.fn();

vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockUseDecksQuery(),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

// API: Fabrary preview and import
const mockPreview = vi.fn();
// OnboardingPage also reads the import list; a fresh account has none.
vi.mock('../../../api/csv-sources', () => ({
  useCsvSourcesQuery: () => ({ isLoading: false, isError: false, data: [] }),
}));
vi.mock('../../../api/fabrary-import', () => ({
  useFabraryPreviewQuery: (text: string) => mockPreview(text),
  useImportFabraryDeckMutation: () => ({
    mutateAsync: mockImportMutateAsync,
    isPending: false,
    error: null,
  }),
}));

// API: deck-detail
const mockUseDeckDetailQuery = vi.fn();
vi.mock('../../../api/deck-detail', () => ({
  useDeckDetailQuery: () => mockUseDeckDetailQuery(),
  deckDetailQueryKey: (id: string) => ['deck-detail', id],
}));

// API: replacements
vi.mock('../../../api/replacements', () => ({
  useUseSuggestions: () => ({ mutate: vi.fn(), isPending: false }),
}));

// ---------------------------------------------------------------------------
// Lazy imports (after mocks are set)
// ---------------------------------------------------------------------------

import { OnboardingWizard } from '../OnboardingWizard';
import { OnboardingPage } from '../../../routes/_auth/onboarding';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeDecksQueryEmpty() {
  return {
    isLoading: false,
    isError: false,
    data: { trackedDecks: [], collectionCardCount: 0, aggregateShoppingLine: null },
  };
}

function makeDecksQueryLoading() {
  return { isLoading: true, isError: false, data: undefined };
}

function makeDecksQueryWithDecks(count = 1) {
  const trackedDecks = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    fabraryUlid: `ulid-${i + 1}`,
    name: `Deck ${i + 1}`,
    hero: 'Dorinthea',
    format: 'CC',
    trackedAt: '2026-01-01T00:00:00.000Z',
    latestSnapshot: { rawPercent: 72, effectivePercent: 85, computedAt: '2026-01-01T00:00:00.000Z' },
    shoppingLine: undefined,
  }));
  return {
    isLoading: false,
    isError: false,
    data: { trackedDecks, collectionCardCount: 100, aggregateShoppingLine: null },
  };
}

function makeImportResponse(): { deckId: number } {
  return { deckId: 1 };
}

const FOUND_DECK = {
  isPending: false,
  isError: false,
  error: null,
  data: { name: 'Test Deck', hero: 'Dorinthea', format: 'CC', totalCards: 60, ownedCards: 12 },
};

const DECK_LINK = 'https://fabrary.net/decks/01J0Z8K4M2ABCDEFGHJKMNPQRS';

/** Pastes a link, says the cards are not the player's and continues. */
async function importInStep1(user: ReturnType<typeof userEvent.setup>, link: string = DECK_LINK): Promise<void> {
  const input = screen.getByRole('textbox', { name: /link do deck no fabrary/i });
  await user.type(input, link);
  await user.click(screen.getByRole('radio', { name: /^não, só quero comparar/i }));
  await user.click(screen.getByRole('button', { name: /continuar/i }));
}

function makeDetailQueryWithSubs() {
  return {
    isLoading: false,
    isError: false,
    data: {
      id: 1,
      fabraryUlid: 'ulid-1',
      name: 'Test Deck',
      hero: 'Dorinthea',
      format: 'CC',
      trackedAt: '2026-01-01T00:00:00.000Z',
      totalCards: 60,
      latestSnapshot: {
        id: 1,
        rawPercent: 72,
        effectivePercent: 85,
        path: 'B' as const,
        fidelityPercent: 88,
        computedAt: '2026-01-01T00:00:00.000Z',
        breakdown: {
          exact: [],
          substituted: [
            {
              original: {
                cardIdentifier: 'EVO001',
                name: 'Ironsong Determination',
                quantity: 1,
                slot: 'mainboard',
                pitch: 1 as const,
                cost: 0,
                type: 'attack',
              },
              match: {
                substitute: {
                  cardIdentifier: 'EVO002',
                  name: 'Singing Steelblade',
                  classes: ['warrior'],
                  pitch: 1,
                  power: 3,
                  defense: 3,
                  keywords: [],
                },
                tier: 1,
                score: 0.9,
                rationale: 'Equivalent pitch 1 attack with similar power.',
              },
            },
          ],
          missing: [],
          notOwned: [
            { cardIdentifier: 'EVO001', name: 'Ironsong Determination', quantity: 1, slot: 'mainboard', pitch: 1 as const, cost: 0, type: 'attack' },
          ],
        },
      },
      replacements: [],
    },
  };
}

function makeDetailQueryWith100Readiness() {
  return {
    isLoading: false,
    isError: false,
    data: {
      id: 1,
      fabraryUlid: 'ulid-1',
      name: 'Test Deck',
      hero: 'Dorinthea',
      format: 'CC',
      trackedAt: '2026-01-01T00:00:00.000Z',
      totalCards: 60,
      latestSnapshot: {
        id: 1,
        rawPercent: 100,
        effectivePercent: 100,
        path: 'A' as const,
        fidelityPercent: 100,
        computedAt: '2026-01-01T00:00:00.000Z',
        breakdown: {
          exact: [],
          substituted: [],
          missing: [],
          notOwned: [],
        },
      },
    },
  };
}

function makeDetailQueryLoading() {
  return { isLoading: true, isError: false, data: undefined };
}

beforeEach(() => {
  mockPreview.mockReturnValue(FOUND_DECK);
});

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderWizard() {
  return render(<OnboardingWizard />);
}

function renderOnboardingPage() {
  return render(<OnboardingPage />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OnboardingWizard — step indicator a11y', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    vi.clearAllMocks();
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders step indicator with aria-label "Step 1 of 3" on mount', () => {
    renderWizard();
    const nav = screen.getByRole('navigation', { name: /passo 1 de 3/i });
    expect(nav).toBeInTheDocument();
  });

  it('step 1 item has aria-current="step"', () => {
    renderWizard();
    const currentStep = screen.getByRole('listitem', { name: /passo 1 de 3: importar deck, atual/i });
    expect(currentStep).toHaveAttribute('aria-current', 'step');
  });
});

describe('OnboardingWizard — step 1: invalid URL format', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    vi.clearAllMocks();
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows format error immediately when user types an invalid URL', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /link do deck no fabrary/i });
    await user.type(input, 'not a url');

    expect(
      screen.getByText(/esse não é um link de deck do fabrary/i),
    ).toBeInTheDocument();
  });

  it('Continue button is disabled when URL format is invalid', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /link do deck no fabrary/i });
    await user.type(input, 'not a url');

    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    expect(continueBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not show error when input is empty', () => {
    renderWizard();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('OnboardingWizard — step 1: skip', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockNavigate.mockReturnValue(Promise.resolve());
    vi.clearAllMocks();
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clicking "Skip for now" calls navigate to /home', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: /^pular$/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home', search: { tag: [] } });
  });
});

describe('OnboardingWizard — happy path: step 1 → step 2', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
    vi.clearAllMocks();
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('advances to step 2 after a successful import', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /passo 2 de 3/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/confira o deck/i)).toBeInTheDocument();
  });

  it('step 2 shows the imported deck name as preview card label', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => {
      // The preview label is a <span> inside the deck preview card
      const nameSpans = screen.getAllByText('Test Deck');
      // At least one match outside of SVG (the previewName span)
      const textNode = nameSpans.find((el) => el.tagName.toLowerCase() !== 'text');
      expect(textNode).toBeTruthy();
    });
  });
});

describe('OnboardingWizard — happy path (skip): step 2 skip', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
    vi.clearAllMocks();
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clicking Skip on step 2 navigates to /home', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => {
      expect(screen.getByText(/confira o deck/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^pular$/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home', search: { tag: [] } });
  });
});

describe('OnboardingWizard — happy path: step 3 with substitutions → /home', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryWithSubs());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
    vi.clearAllMocks();
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryWithSubs());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 3 heading on step 3', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => expect(screen.getByText(/confira o deck/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/cartas da sua coleção/i)).toBeInTheDocument();
    });
  });

  it('step 3 offers to use the suggestions, with no approve or reject', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => expect(screen.getByText(/confira o deck/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Usar a carta da coleção' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /aprovar|recusar/i })).toBeNull();
    });
  });

  it('"Agora não" on step 3 navigates to /home', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => expect(screen.getByText(/confira o deck/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home', search: { tag: [] } });
  });
});

describe('OnboardingWizard — edge case: missing or private deck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockNavigate.mockReturnValue(Promise.resolve());
    mockPreview.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      error: new ApiError(404, JSON.stringify({ code: 'FABRARY_DECK_NOT_FOUND' })),
    });
  });

  afterEach(() => {
    mockPreview.mockReturnValue(FOUND_DECK);
    vi.clearAllMocks();
  });

  it('shows the missing-or-private copy when the preview answers 404', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByRole('textbox', { name: /link do deck no fabrary/i }), DECK_LINK);

    await waitFor(() => {
      expect(screen.getByText(/é privado no fabrary/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});

describe('OnboardingWizard — the Fabrary import asks whose cards they are', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  it('the onboarding Fabrary import asks whose cards they are', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(screen.getByRole('textbox', { name: /link do deck no fabrary/i }), DECK_LINK);

    expect(screen.getByText('Essas cartas são suas?')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sim, colocar na minha coleção' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Não, só quero comparar com o que eu tenho' })).not.toBeChecked();
    const next = screen.getByRole('button', { name: /continuar/i });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    await user.click(next);
    expect(mockImportMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('radio', { name: 'Sim, colocar na minha coleção' }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    expect(mockImportMutateAsync).toHaveBeenCalledWith({ text: DECK_LINK, ownsCards: true });
  });
});

describe('OnboardingWizard — edge case: 100% readiness', () => {
  const fullReadinessDecks = {
    isLoading: false,
    isError: false,
    data: {
      trackedDecks: [
        {
          id: 1,
          fabraryUlid: 'ulid-1',
          name: 'Test Deck',
          hero: 'Dorinthea',
          format: 'CC',
          trackedAt: '2026-01-01T00:00:00.000Z',
          latestSnapshot: { rawPercent: 100, effectivePercent: 100, computedAt: '2026-01-01T00:00:00.000Z' },
        },
      ],
      collectionCardCount: 100,
      aggregateShoppingLine: null,
    },
  };

  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(fullReadinessDecks);
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryWith100Readiness());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
    vi.clearAllMocks();
    mockUseDecksQuery.mockReturnValue(fullReadinessDecks);
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryWith100Readiness());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows CongratsAllPlayable when deck has 100% raw readiness', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => expect(screen.getByText(/confira o deck/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await waitFor(() => {
      expect(screen.getByText(/seu deck está completo/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /ir para meus decks/i })).toBeInTheDocument();
  });

  it('CongratsAllPlayable CTA navigates to /home', async () => {
    const user = userEvent.setup();
    renderWizard();

    await importInStep1(user);

    await waitFor(() => expect(screen.getByText(/confira o deck/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ir para meus decks/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /ir para meus decks/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home', search: { tag: [] } });
  });
});

describe('OnboardingWizard — edge case: 10s computation timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows "Continue without review" after 10s timeout when loading', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWizard();

    await importInStep1(user);

    await waitFor(() => expect(screen.getByText(/confira o deck/i)).toBeInTheDocument());

    // Advance to step 3
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    // Step 3 renders loading state immediately
    await waitFor(() => {
      expect(screen.getByText(/comparando com a sua coleção/i)).toBeInTheDocument();
    });

    // Advance 10+ seconds to trigger the computation timeout
    act(() => {
      vi.advanceTimersByTime(10_001);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /seguir sem revisar/i })).toBeInTheDocument();
    });
  });
});

describe('OnboardingWizard — R60 guard (OnboardingPage): redirect to /decks/new', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders skeleton while decks query is loading (prevents blank flash)', () => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryLoading());
    renderOnboardingPage();
    // The skeleton carries aria-busy to communicate the loading state (R59).
    const skeleton = screen.getByRole('region', { name: /^carregando$/i });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('renders Navigate to /decks/new when user has existing tracked decks', () => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryWithDecks(1));
    renderOnboardingPage();
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).toHaveAttribute('data-to', '/decks/new');
  });

  it('renders the first-run chooser for a fresh user (0 tracked decks)', () => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    renderOnboardingPage();
    expect(screen.getByRole('heading', { name: 'Como você quer começar?' })).toBeInTheDocument();
  });
});

describe('OnboardingWizard — edge case: unreachable URL (timeout)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockNavigate.mockReturnValue(Promise.resolve());
    // Simulate an import that never resolves (pending forever — AbortController will time it out)
    mockImportMutateAsync.mockImplementation(
      () => new Promise((_resolve, _reject) => {
        // The promise intentionally never resolves; the AbortController timeout
        // fires after 5s and sets the error message.
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the unreachable copy after 5s without a response', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWizard();

    await importInStep1(user);

    // Advance 5s+ to trigger the unreachable timeout in Step1PasteUrl
    act(() => {
      vi.advanceTimersByTime(5_001);
    });

    await waitFor(() => {
      expect(screen.getByText(/demorou demais para responder/i)).toBeInTheDocument();
    });
  });
});

describe('OnboardingWizard — stepper navigation (AUTH-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(makeImportResponse());
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  async function advanceToStep2(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await importInStep1(user);
    await waitFor(() => expect(screen.getByRole('navigation', { name: /passo 2 de 3/i })).toBeInTheDocument());
  }

  it('on step 1 no stepper node is a button', () => {
    renderWizard();
    const nav = screen.getByRole('navigation', { name: /passo 1 de 3/i });
    expect(within(nav).queryAllByRole('button')).toHaveLength(0);
  });

  it('on step 2 the completed node 1 is a button and the upcoming node 3 is not', async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    const nav = screen.getByRole('navigation', { name: /passo 2 de 3/i });
    expect(within(nav).getAllByRole('button')).toHaveLength(1);
    expect(within(nav).getByRole('button', { name: /passo 1 de 3: importar deck, concluído/i })).toBeInTheDocument();
    expect(within(nav).getByRole('listitem', { name: /passo 3 de 3.*próximo/i }).querySelector('[aria-disabled="true"]')).not.toBeNull();
  });

  it('activating the completed node returns to that step without navigating away', async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /passo 1 de 3: importar deck, concluído/i }));
    expect(screen.getByRole('navigation', { name: /passo 1 de 3/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /link do deck no fabrary/i })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

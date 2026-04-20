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
 *  - Integration (R60 guard): user with tracked decks is redirected to /import
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
  type Mock,
} from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  useNavigate: () => mockNavigate,
}));

// API: decks
const mockUseDecksQuery = vi.fn();
const mockImportMutateAsync = vi.fn();
let mockImportIsPending = false;

vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockUseDecksQuery(),
  useImportDecksMutation: () => ({
    mutateAsync: mockImportMutateAsync,
    isPending: mockImportIsPending,
    error: null,
  }),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

// API: deck-detail
const mockUseDeckDetailQuery = vi.fn();
vi.mock('../../../api/deck-detail', () => ({
  useDeckDetailQuery: () => mockUseDeckDetailQuery(),
  deckDetailQueryKey: (id: string) => ['deck-detail', id],
}));

// API: decisions
const mockDecideMutate = vi.fn();
vi.mock('../../../api/decisions', () => ({
  useDecideSubstitutionMutation: () => ({
    mutate: mockDecideMutate,
    isPending: false,
  }),
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

function makeImportResponse(overrides: Partial<{
  imported: unknown[];
  skipped: unknown[];
  errors: unknown[];
}> = {}) {
  return {
    imported: overrides.imported ?? [
      {
        trackedDeckId: 1,
        name: 'Test Deck',
        hero: 'Dorinthea',
        format: 'CC',
        readinessSnapshot: { rawPercent: 72, effectivePercent: 85 },
      },
    ],
    skipped: overrides.skipped ?? [],
    errors: overrides.errors ?? [],
  };
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
      rejectedCount: 0,
      approvedCount: 0,
      pendingCount: 1,
      decisions: [],
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
                quantity: 1,
                slot: 'Ironsong Determination (1)',
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
          notOwned: [],
        },
      },
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
      rejectedCount: 0,
      approvedCount: 0,
      pendingCount: 0,
      decisions: [],
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
    const nav = screen.getByRole('navigation', { name: /step 1 of 3/i });
    expect(nav).toBeInTheDocument();
  });

  it('step 1 item has aria-current="step"', () => {
    renderWizard();
    const currentStep = screen.getByRole('listitem', { name: /step 1 of 3: paste deck, current/i });
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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'not a url');

    expect(
      screen.getByText(/must be a valid fabrary deck url/i),
    ).toBeInTheDocument();
  });

  it('Continue button is disabled when URL format is invalid', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'not a url');

    const continueBtn = screen.getByRole('button', { name: /continue/i });
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

    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' });
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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /step 2 of 3/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/your library/i)).toBeInTheDocument();
  });

  it('step 2 shows the imported deck name as preview card label', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/your library/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' });
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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/substitutions are honest/i)).toBeInTheDocument();
    });
  });

  it('step 3 shows substitution approve/reject buttons', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /approve/i })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: /reject/i })).toHaveLength(1);
    });
  });

  it('"Enter the armory" on step 3 navigates to /home', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enter the armory/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /enter the armory/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' });
  });
});

describe('OnboardingWizard — edge case: private deck error from backend', () => {
  beforeEach(() => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(
      makeImportResponse({
        imported: [],
        errors: [{ url: 'https://fabrary.net/decks/PRIV', code: 'private_deck', message: 'Private deck' }],
      }),
    );
    mockNavigate.mockReturnValue(Promise.resolve());
    vi.clearAllMocks();
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    mockUseDeckDetailQuery.mockReturnValue(makeDetailQueryLoading());
    mockImportMutateAsync.mockResolvedValue(
      makeImportResponse({
        imported: [],
        errors: [{ url: 'https://fabrary.net/decks/PRIV', code: 'private_deck', message: 'Private deck' }],
      }),
    );
    mockNavigate.mockReturnValue(Promise.resolve());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows private-deck copy when backend returns private_deck error code', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/PRIV');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/set to private on fabrary/i)).toBeInTheDocument();
    });
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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/fully playable/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /go to my decks/i })).toBeInTheDocument();
  });

  it('CongratsAllPlayable CTA navigates to /home', async () => {
    const user = userEvent.setup();
    renderWizard();

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go to my decks/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /go to my decks/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' });
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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/VALID01');

    // Resolve import immediately
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/your library/i)).toBeInTheDocument());

    // Advance to step 3
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    // Step 3 renders loading state immediately
    await waitFor(() => {
      expect(screen.getByText(/computing substitutions/i)).toBeInTheDocument();
    });

    // Advance 10+ seconds to trigger the computation timeout
    act(() => {
      vi.advanceTimersByTime(10_001);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue without review/i })).toBeInTheDocument();
    });
  });
});

describe('OnboardingWizard — R60 guard (OnboardingPage)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders null while decks query is loading (prevents flash)', () => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryLoading());
    const { container } = renderOnboardingPage();
    expect(container.firstChild).toBeNull();
  });

  it('renders Navigate to /import when user has existing tracked decks', () => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryWithDecks(1));
    renderOnboardingPage();
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).toHaveAttribute('data-to', '/import');
  });

  it('renders the wizard for a fresh user (0 tracked decks)', () => {
    mockUseDecksQuery.mockReturnValue(makeDecksQueryEmpty());
    renderOnboardingPage();
    // The wizard renders step 1 which has the step indicator nav
    expect(screen.getByRole('navigation', { name: /step 1 of 3/i })).toBeInTheDocument();
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

    const input = screen.getByRole('textbox', { name: /fabrary deck url/i });
    await user.type(input, 'https://fabrary.net/decks/SLOW01');

    // Click Continue which starts the import + timeout
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Advance 5s+ to trigger the unreachable timeout in Step1PasteUrl
    act(() => {
      vi.advanceTimersByTime(5_001);
    });

    await waitFor(() => {
      expect(screen.getByText(/took too long to respond/i)).toBeInTheDocument();
    });
  });
});

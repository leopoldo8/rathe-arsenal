/**
 * Onboarding R60 redirect tests
 *
 * Verifies that the R60 returning-user routing guard redirects to
 * /decks/new (deck tracking) rather than /add-cards/fabrary (cards-only import).
 *
 * Covers:
 *  - Happy path: user with tracked decks is redirected to /decks/new
 *  - Not redirected to /import (legacy) or /add-cards/fabrary (cards-only)
 *  - Happy path: fresh user (0 decks, 0 cards) sees the first-run chooser
 *  - Loading state: null render while query resolves (prevents flash)
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAuth, renderWithAuth, stubViewport } from '../../../components/auth/__tests__/accountTestKit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const chooser = vi.hoisted(() => ({ real: false }));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => undefined,
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Navigate: ({ to }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  ),
  useNavigate: () => navigateMock,
  useRouter: () => ({ history: { push: vi.fn() } }),
}));
vi.mock('../../../components/ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

const mockUseDecksQuery = vi.fn();
vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockUseDecksQuery(),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

// The import list: an account whose import kept no card still has the import (D10).
const mockUseCsvSourcesQuery = vi.fn();
vi.mock('../../../api/csv-sources', () => ({
  useCsvSourcesQuery: () => mockUseCsvSourcesQuery(),
}));

// FirstRunChooser — stubbed so most tests only read the redirect guard; the real screen where a test names it
vi.mock('../../../components/onboarding/FirstRunChooser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../components/onboarding/FirstRunChooser')>();
  return { FirstRunChooser: () => (chooser.real ? <actual.FirstRunChooser /> : <div data-testid="first-run-chooser" />) };
});

// OnboardingSkeleton — stub so the loading-state test stays isolated from the skeleton impl
vi.mock('../../../components/onboarding/OnboardingSkeleton', () => ({
  OnboardingSkeleton: () => <div data-testid="onboarding-skeleton" />,
}));

import { OnboardingPage } from '../onboarding';
import { NewAccountStep } from '../../../components/auth/NewAccountStep';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWithDecks(count = 1) {
  const trackedDecks = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    fabraryUlid: `ulid-${i + 1}`,
    name: `Deck ${i + 1}`,
    hero: 'Dorinthea',
    format: 'CC',
    trackedAt: '2026-01-01T00:00:00.000Z',
    latestSnapshot: null,
  }));
  return {
    isLoading: false,
    isError: false,
    data: { trackedDecks, collectionCardCount: 0, aggregateShoppingLine: null },
  };
}

function makeQueryEmpty() {
  return {
    isLoading: false,
    isError: false,
    data: { trackedDecks: [], collectionCardCount: 0, aggregateShoppingLine: null },
  };
}

function makeQueryLoading() {
  return { isLoading: true, isError: false, data: undefined };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseCsvSourcesQuery.mockReturnValue({ isLoading: false, isError: false, data: [] });
});

afterEach(() => {
  vi.clearAllMocks();
  chooser.real = false;
});

describe('OnboardingPage — R60 redirect', () => {
  it('redirects to /decks/new when user has tracked decks', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryWithDecks(1));
    render(<OnboardingPage />);
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).toHaveAttribute('data-to', '/decks/new');
  });

  it('does not redirect to /import (legacy route deleted in Unit 9)', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryWithDecks(1));
    render(<OnboardingPage />);
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).not.toHaveAttribute('data-to', '/import');
  });

  it('does not redirect to /add-cards/fabrary (cards-only import route)', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryWithDecks(1));
    render(<OnboardingPage />);
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).not.toHaveAttribute('data-to', '/add-cards/fabrary');
  });

  it('a new account starts on the first-run chooser', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryEmpty());
    render(<OnboardingPage />);
    expect(screen.getByTestId('first-run-chooser')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-redirect')).not.toBeInTheDocument();
  });

  it('a new account starts on the first-run chooser: the real screen, with its ways in', () => {
    chooser.real = true;
    mockUseDecksQuery.mockReturnValue(makeQueryEmpty());
    render(<OnboardingPage />);

    expect(screen.getByRole('heading', { name: 'Como você quer começar?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comprei um deck pronto/ })).toHaveAttribute('href', '/add-cards/product');
    expect(screen.getByRole('link', { name: 'Pular por agora' })).toHaveAttribute('href', '/home');
    expect(screen.queryByTestId('navigate-redirect')).not.toBeInTheDocument();
  });

  it('a new account starts on the first-run chooser: signing up sends it there, with or without a password', async () => {
    stubViewport(true);
    const props = { email: 'bia.souza@gmail.com', shareReturn: null, origin: null, onWrongEmail: vi.fn() };

    const withoutPassword = renderWithAuth(<NewAccountStep {...props} />, makeAuth());
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/onboarding' }));
    withoutPassword.unmount();
    navigateMock.mockClear();

    renderWithAuth(<NewAccountStep {...props} />, makeAuth());
    await userEvent.click(screen.getByRole('button', { name: 'Prefiro criar uma senha' }));
    await userEvent.type(screen.getByLabelText('Senha'), '1234567890');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta com senha e entrar' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/onboarding' }));
    expect(navigateMock).toHaveBeenCalledTimes(1);
  });

  it('a new account starts on the first-run chooser: an account with an import does not land on it', () => {
    mockUseDecksQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { trackedDecks: [], collectionCardCount: 612, aggregateShoppingLine: null },
    });
    render(<OnboardingPage />);
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/library');
    expect(screen.queryByTestId('first-run-chooser')).not.toBeInTheDocument();
  });

  it('an account whose import has only unresolved lines does not land on the chooser', () => {
    // The import kept no card (every line is waiting to be resolved), so the deck query counts 0 cards.
    mockUseDecksQuery.mockReturnValue(makeQueryEmpty());
    mockUseCsvSourcesQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ id: 's1', kind: 'csv', label: 'colecao-lucas.csv', cardCount: 0, copies: 0, active: true }],
    });
    render(<OnboardingPage />);
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/library');
    expect(screen.queryByTestId('first-run-chooser')).not.toBeInTheDocument();
  });

  it('shows the skeleton, not the chooser, while the import list loads', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryEmpty());
    mockUseCsvSourcesQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    render(<OnboardingPage />);
    expect(screen.getByTestId('onboarding-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('first-run-chooser')).not.toBeInTheDocument();
  });

  it('an account with cards but no deck goes to the collection, not to the chooser', () => {
    mockUseDecksQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { trackedDecks: [], collectionCardCount: 12, aggregateShoppingLine: null },
    });
    render(<OnboardingPage />);
    expect(screen.getByTestId('navigate-redirect')).toHaveAttribute('data-to', '/library');
    expect(screen.queryByTestId('first-run-chooser')).not.toBeInTheDocument();
  });

  it('renders a skeleton (not null) while decks query is loading (R59)', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryLoading());
    render(<OnboardingPage />);
    expect(screen.getByTestId('onboarding-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-redirect')).not.toBeInTheDocument();
    expect(screen.queryByTestId('first-run-chooser')).not.toBeInTheDocument();
  });
});

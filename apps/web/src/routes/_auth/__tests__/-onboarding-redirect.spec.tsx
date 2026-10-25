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
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => undefined,
  Navigate: ({ to }: { to: string; replace?: boolean }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  ),
  useNavigate: () => vi.fn(),
}));

const mockUseDecksQuery = vi.fn();
vi.mock('../../../api/decks', () => ({
  useDecksQuery: () => mockUseDecksQuery(),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

// FirstRunChooser — stub so this file only tests the redirect guard
vi.mock('../../../components/onboarding/FirstRunChooser', () => ({
  FirstRunChooser: () => <div data-testid="first-run-chooser" />,
}));

// OnboardingSkeleton — stub so the loading-state test stays isolated from the skeleton impl
vi.mock('../../../components/onboarding/OnboardingSkeleton', () => ({
  OnboardingSkeleton: () => <div data-testid="onboarding-skeleton" />,
}));

import { OnboardingPage } from '../onboarding';

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

afterEach(() => {
  vi.clearAllMocks();
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

/**
 * Onboarding R60 redirect tests — Unit 9
 *
 * Verifies that the R60 returning-user routing guard redirects to
 * /add-cards/fabrary (not /import) after Plan C Unit 9.
 *
 * Covers:
 *  - Happy path: user with tracked decks is redirected to /add-cards/fabrary
 *  - Happy path: fresh user (0 decks) sees the onboarding wizard
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
  useImportDecksMutation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

// OnboardingWizard — stub so this file only tests the redirect guard
vi.mock('../../../components/onboarding/OnboardingWizard', () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard" />,
}));

// OnboardingSkeleton — stub so the loading state is a predictable element
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

describe('OnboardingPage — R60 redirect (Unit 9)', () => {
  it('redirects to /add-cards/fabrary when user has tracked decks', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryWithDecks(1));
    render(<OnboardingPage />);
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).toHaveAttribute('data-to', '/add-cards/fabrary');
  });

  it('does not redirect to /import (legacy route deleted in Unit 9)', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryWithDecks(1));
    render(<OnboardingPage />);
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).not.toHaveAttribute('data-to', '/import');
  });

  it('renders the wizard for a fresh user (0 tracked decks)', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryEmpty());
    render(<OnboardingPage />);
    expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-redirect')).not.toBeInTheDocument();
  });

  it('renders the loading skeleton while decks query is loading', () => {
    mockUseDecksQuery.mockReturnValue(makeQueryLoading());
    render(<OnboardingPage />);
    expect(screen.getByTestId('onboarding-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-redirect')).not.toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument();
  });
});

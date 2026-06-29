import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { AuthContext, IAuthContext } from '../../../auth/AuthContext';
import { EducationalEmptyState } from '../EducationalEmptyState';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const noopAsync = async (): Promise<void> => {
  /* test stub */
};

const stubAuthContext: IAuthContext = {
  user: null,
  token: null,
  isLoading: false,
  setSettings: () => {
    /* test stub */
  },
  signUp: async () => ({}),
  signIn: noopAsync,
  signOut: () => {
    /* test stub */
  },
  verifyEmail: noopAsync,
  forgotPassword: noopAsync,
  resetPassword: noopAsync,
  deleteAccount: noopAsync,
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderEmpty(collectionCardCount = 0) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={stubAuthContext}>
        <EducationalEmptyState collectionCardCount={collectionCardCount} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EducationalEmptyState', () => {
  it('renders the welcome heading', () => {
    renderEmpty();
    expect(screen.getByRole('heading', { name: /bem-vindo, herói/i })).toBeInTheDocument();
  });

  it('renders the 3-step explainer', () => {
    renderEmpty();
    expect(screen.getByText(/cole um deck/i)).toBeInTheDocument();
    expect(screen.getByText(/veja sua prontidão/i)).toBeInTheDocument();
    expect(screen.getByText(/aprovar e comprar/i)).toBeInTheDocument();
  });

  it('renders the primary CTA link pointing to /decks/new', () => {
    renderEmpty();
    const importLink = screen.getByRole('link', { name: /rastrear seu primeiro deck/i });
    expect(importLink).toBeInTheDocument();
    expect(importLink).toHaveAttribute('href', '/decks/new');
  });

  it('renders the "Skip to Library" secondary link', () => {
    renderEmpty();
    const skipLink = screen.getByRole('link', { name: /ir para a biblioteca/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '/library');
  });

  it('shows collection card count hint when count > 0', () => {
    renderEmpty(5);
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/na sua coleção/i)).toBeInTheDocument();
  });

  it('does not show collection count hint when count is 0', () => {
    renderEmpty(0);
    expect(screen.queryByText(/na sua coleção/i)).not.toBeInTheDocument();
  });

  it('renders the manual card add section', () => {
    renderEmpty();
    expect(
      screen.getByText(/quer adicionar cards sem um csv/i),
    ).toBeInTheDocument();
  });
});

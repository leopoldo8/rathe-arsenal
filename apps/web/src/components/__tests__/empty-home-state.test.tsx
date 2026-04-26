import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { EmptyHomeState } from '../empty-home-state';
import { AuthContext, IAuthContext } from '../../auth/AuthContext';

/**
 * A18 smoke test: proves the Vitest + React Testing Library + jest-dom
 * pipeline works end-to-end for the web package.
 *
 * `EmptyHomeState` embeds `<CardAutocomplete>`, which calls `useAuth` and
 * `useQuery`. Tests therefore wrap the render in a minimal
 * `AuthContext.Provider` and a disposable `QueryClient` so the component
 * tree can mount without touching the network.
 */

const noopAsync = async () => {
  /* test stub */
};

const stubAuthContext: IAuthContext = {
  user: null,
  token: null,
  isLoading: false,
  signUp: async () => ({}),
  signIn: noopAsync,
  signOut: () => {
    /* test stub */
  },
  verifyEmail: noopAsync,
  forgotPassword: noopAsync,
  resetPassword: noopAsync,
  deleteAccount: noopAsync,
  setSettings: () => {
    /* test stub */
  },
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={stubAuthContext}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('EmptyHomeState', () => {
  it('renders the welcome heading when the collection is empty', () => {
    // Arrange + Act
    renderWithProviders(<EmptyHomeState collectionCardCount={0} />);

    // Assert
    expect(
      screen.getByRole('heading', { name: /welcome to rathe arsenal/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/already have .* cards in your collection/i),
    ).not.toBeInTheDocument();
  });

  it('surfaces the collection count when the user has cards but no decks', () => {
    // Arrange + Act
    renderWithProviders(<EmptyHomeState collectionCardCount={3} />);

    // Assert
    expect(
      screen.getByText(/you already have 3 cards in your collection\./i),
    ).toBeInTheDocument();
  });
});

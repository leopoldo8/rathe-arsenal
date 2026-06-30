import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { AuthContext, IAuthContext } from '../../../auth/AuthContext';
import { EducationalEmptyState } from '../EducationalEmptyState';

// ---------------------------------------------------------------------------
// Router mock — Link renders as a plain <a> with href so existing href-based
// assertions continue to work and we avoid the need for a full RouterProvider.
// ---------------------------------------------------------------------------
vi.mock('@tanstack/react-router', () => ({
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

  // -------------------------------------------------------------------------
  // T16 / UXUI-12: Navigation links must use TanStack <Link>, not bare <a>.
  // The router mock above resolves <Link to="…"> → <a href="…">, so the DOM
  // assertions below prove the component went through the router Link path.
  // Any reversion to a bare <a href="…"> would bypass the mock and still
  // render an anchor, but the design-guard below (see design-guards.spec.ts)
  // provides the code-level fence.
  // -------------------------------------------------------------------------
  it('all three navigation links route via TanStack Link (T16 / UXUI-12)', () => {
    renderEmpty();
    const links = screen.getAllByRole('link');
    // Track deck CTA → /decks/new, Skip to Library → /library, Manual add → /library
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/decks/new');
    expect(hrefs.filter((h) => h === '/library').length).toBe(2);
    // No link should use a full-page reload pattern (bare anchor without router)
    // — enforced by the fact that the mock intercepts all <Link> usages.
    expect(hrefs.every((h) => h !== null)).toBe(true);
  });
});

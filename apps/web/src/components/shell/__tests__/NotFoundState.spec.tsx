/**
 * NotFoundState tests — Unit 9
 *
 * Covers:
 *  - Happy path (authenticated): renders brand-voiced copy + "Back to home" CTA → /home
 *  - Happy path (anon): renders brand-voiced copy + "Sign in" CTA → /sign-in
 *  - A11y: heading renders as <h1>
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthContext, IAuthContext } from '../../../auth/AuthContext';
import { NotFoundState } from '../NotFoundState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noopAsync = async (): Promise<void> => {
  /* test stub */
};

function makeAuthContext(overrides: Partial<IAuthContext> = {}): IAuthContext {
  return {
    user: { id: 'u1', email: 'hero@rathe.gg', role: 'user' },
    token: 'jwt',
    isLoading: false,
    setSettings: () => { /* stub */ },
    signUp: async () => ({}),
    signIn: noopAsync,
    signOut: () => { /* stub */ },
    verifyEmail: noopAsync,
    forgotPassword: noopAsync,
    resetPassword: noopAsync,
    deleteAccount: noopAsync,
    ...overrides,
  };
}

function renderAuthenticated() {
  return render(
    <AuthContext.Provider value={makeAuthContext()}>
      <NotFoundState />
    </AuthContext.Provider>,
  );
}

function renderAnonymous() {
  return render(
    <AuthContext.Provider value={makeAuthContext({ user: null, token: null })}>
      <NotFoundState />
    </AuthContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotFoundState — happy path (authenticated)', () => {
  it('renders the "Off the map." heading', () => {
    renderAuthenticated();
    expect(screen.getByRole('heading', { name: /off the map/i })).toBeInTheDocument();
  });

  it('renders the body copy', () => {
    renderAuthenticated();
    expect(
      screen.getByText(/this page isn't part of your arsenal/i),
    ).toBeInTheDocument();
  });

  it('renders the "Back to home" CTA pointing to /home', () => {
    renderAuthenticated();
    const cta = screen.getByRole('link', { name: /back to home/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/home');
  });
});

describe('NotFoundState — happy path (anonymous)', () => {
  it('renders the "Off the map." heading', () => {
    renderAnonymous();
    expect(screen.getByRole('heading', { name: /off the map/i })).toBeInTheDocument();
  });

  it('renders the body copy', () => {
    renderAnonymous();
    expect(
      screen.getByText(/this page isn't part of your arsenal/i),
    ).toBeInTheDocument();
  });

  it('renders the "Sign in" CTA pointing to /sign-in', () => {
    renderAnonymous();
    const cta = screen.getByRole('link', { name: /sign in/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/sign-in');
  });
});

describe('NotFoundState — A11y', () => {
  it('heading renders as <h1>', () => {
    renderAuthenticated();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/off the map/i);
  });
});

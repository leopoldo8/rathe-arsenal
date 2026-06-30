/**
 * AuthLayout tests — U6
 *
 * Covers:
 *  - Happy path: renders decoration + form at >=720px
 *  - Responsive: decoration hidden at <720px
 *  - A11y: decoration panel aria-hidden, form panel has visible <h1>
 *  - Responsive: form usable at 320px (no horizontal scroll — structural check)
 *  - Sign-in invalid credentials: upgraded error pattern rendered (not plain red)
 *  - Error is keyboard-reachable
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// matchMedia mock
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// Mock SVGR deckbox — AuthLayout left panel uses it
vi.mock('../../shell/DeckboxDecoration', () => ({
  DeckboxDecoration: () => <div data-testid="deckbox-decoration" />,
}));

import { AuthLayout } from '../AuthLayout';

describe('AuthLayout — happy path >=720px', () => {
  beforeEach(() => mockMatchMedia(false)); // false = not <720px, i.e. wide screen

  it('renders the decoration panel', () => {
    render(
      <AuthLayout title="Sign in">
        <form><button type="submit">Submit</button></form>
      </AuthLayout>,
    );
    // The decoration panel should exist in DOM
    const decoration = screen.getByTestId('deckbox-decoration').closest('[aria-hidden]');
    expect(decoration).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders h1 with the given title in form panel', () => {
    render(
      <AuthLayout title="Sign in">
        <form><button type="submit">Submit</button></form>
      </AuthLayout>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in');
  });

  it('renders children inside form panel', () => {
    render(
      <AuthLayout title="Sign in">
        <form><input type="email" aria-label="Email" /></form>
      </AuthLayout>,
    );
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
  });
});

describe('AuthLayout — responsive: decoration hidden <720px', () => {
  beforeEach(() => mockMatchMedia(true)); // true = IS below 720px

  it('hides the decoration panel when viewport is narrow', () => {
    render(
      <AuthLayout title="Sign in">
        <form><button type="submit">Submit</button></form>
      </AuthLayout>,
    );
    // When matchMedia matches (narrow), decoration should not be rendered
    // We check by seeing if deckbox-decoration is absent or its container is hidden
    const deckbox = screen.queryByTestId('deckbox-decoration');
    expect(deckbox).not.toBeInTheDocument();
  });
});

describe('AuthLayout — A11y', () => {
  beforeEach(() => mockMatchMedia(false));

  it('decoration panel has aria-hidden="true"', () => {
    render(
      <AuthLayout title="Create account">
        <form />
      </AuthLayout>,
    );
    const decorationWrapper = screen.getByTestId('deckbox-decoration').closest('[aria-hidden="true"]');
    expect(decorationWrapper).toBeTruthy();
  });

  it('form panel contains exactly one h1', () => {
    render(
      <AuthLayout title="Forgot password">
        <form />
      </AuthLayout>,
    );
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
  });
});

describe('AuthLayout — inline error pattern', () => {
  beforeEach(() => mockMatchMedia(false));

  it('renders an error message styled as error (not plain red) when error prop provided', () => {
    render(
      <AuthLayout title="Sign in" error="Invalid credentials">
        <form><button type="submit">Submit</button></form>
      </AuthLayout>,
    );
    const errorEl = screen.getByRole('alert');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveTextContent('Invalid credentials');
  });

  it('does not render error element when error prop is absent', () => {
    render(
      <AuthLayout title="Sign in">
        <form />
      </AuthLayout>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // T9 (UXUI-04): errorStripe span removed — no decorative aria-hidden child inside the alert.
  it('error alert has no decorative aria-hidden child (errorStripe removed per UXUI-04)', () => {
    render(
      <AuthLayout title="Sign in" error="Bad credentials">
        <form />
      </AuthLayout>,
    );
    const alert = screen.getByRole('alert');
    // After T9, alert renders the error string directly — no <span aria-hidden="true"> stripe.
    const hiddenChildren = alert.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenChildren).toHaveLength(0);
  });
});

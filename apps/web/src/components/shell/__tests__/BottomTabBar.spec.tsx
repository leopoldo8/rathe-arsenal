/**
 * BottomTabBar tests — Unit 9
 *
 * Covers:
 *  - Happy path: 3 tab items (Home / Library / Swaps), no Import
 *  - A11y: mobile nav has correct aria-label
 *  - No /import data-to attribute
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks ---

// Mutable so individual tests can drive different routes through
// resolveActiveNavKey — reset in a beforeEach below.
let mockPathname = '/home';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select?: (s: { location: { pathname: string } }) => unknown;
  } = {}) => {
    const state = { location: { pathname: mockPathname } };
    if (typeof select === 'function') return select(state);
    return state;
  },
}));

import { BottomTabBar } from '../BottomTabBar';

beforeEach(() => {
  mockPathname = '/home';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BottomTabBar — tab items', () => {
  it('renders exactly 3 tab links', () => {
    render(<BottomTabBar />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(3);
  });

  it('renders the Home tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Início')).toBeInTheDocument();
  });

  it('renders the Library tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Biblioteca')).toBeInTheDocument();
  });

  it('renders the Swaps tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Trocas')).toBeInTheDocument();
  });

  it('does not render an Import tab', () => {
    render(<BottomTabBar />);
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  it('does not render a link to /import', () => {
    render(<BottomTabBar />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const importLinks = nav.querySelectorAll('[data-to="/import"]');
    expect(importLinks).toHaveLength(0);
  });
});

describe('BottomTabBar — A11y', () => {
  it('has aria-label="Mobile primary"', () => {
    render(<BottomTabBar />);
    expect(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// FND-06: nav active-item rule, via the shared resolveActiveNavKey helper.
// Same regression coverage as TopBar — BottomTabBar duplicated the same
// broken logic independently before this phase.
// ---------------------------------------------------------------------------

describe('BottomTabBar — FND-06 active-item rule', () => {
  it('activates Home when on a deck detail route', () => {
    mockPathname = '/decks/abc-123';
    render(<BottomTabBar />);
    const homeTab = screen.getByRole('link', { name: /Início/i });
    expect(homeTab).toHaveAttribute('data-active', 'true');
    expect(homeTab).toHaveAttribute('aria-current', 'page');
  });

  it('activates Library when on /library-csv-sources', () => {
    mockPathname = '/library-csv-sources';
    render(<BottomTabBar />);
    const libraryTab = screen.getByRole('link', { name: /Biblioteca/i });
    expect(libraryTab).toHaveAttribute('data-active', 'true');
    expect(libraryTab).toHaveAttribute('aria-current', 'page');
  });

  it('activates Library when on /add-cards', () => {
    mockPathname = '/add-cards';
    render(<BottomTabBar />);
    const libraryTab = screen.getByRole('link', { name: /Biblioteca/i });
    expect(libraryTab).toHaveAttribute('data-active', 'true');
  });
});

/**
 * BottomTabBar tests — Unit 9
 *
 * Covers:
 *  - Happy path: 2 tab items (Home / Library), no Swaps, no Import
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

let mockChatAccess = false;
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: '1', email: 'hero@rathe.gg', role: 'user', chatAccess: mockChatAccess } }),
}));

import { BottomTabBar } from '../BottomTabBar';

beforeEach(() => {
  mockPathname = '/home';
  mockChatAccess = false;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BottomTabBar — tab items', () => {
  it('renders exactly 2 tab links', () => {
    render(<BottomTabBar />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(2);
  });

  it('renders the Home tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Início')).toBeInTheDocument();
  });

  it('renders the Library tab', () => {
    render(<BottomTabBar />);
    expect(screen.getByText('Biblioteca')).toBeInTheDocument();
  });

  it('has no swaps entry', () => {
    const { container } = render(<BottomTabBar />);
    expect(screen.queryByText('Trocas')).toBeNull();
    expect(container.querySelector('a[href^="/swaps"]')).toBeNull();
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

describe('BottomTabBar — Tutor', () => {
  it('the Tutor tab follows chat access', () => {
    mockChatAccess = true;
    const granted = render(<BottomTabBar />);
    const links = Array.from(granted.container.querySelectorAll('nav a'));
    expect(links).toHaveLength(3);
    expect([links[2]!.textContent, links[2]!.getAttribute('href')]).toEqual(['Tutor', '/chat']);
    granted.unmount();

    mockChatAccess = false;
    const refused = render(<BottomTabBar />);
    expect(refused.container.querySelectorAll('nav a')).toHaveLength(2);
    expect(screen.queryByText('Tutor')).toBeNull();
  });

  it('the Tutor tab is active on chat paths', () => {
    mockChatAccess = true;
    mockPathname = '/chat/abc';
    render(<BottomTabBar />);
    expect(screen.getByText('Tutor').closest('a')).toHaveAttribute('aria-current', 'page');
  });
});

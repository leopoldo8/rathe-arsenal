/**
 * TopBar tests — Unit 9
 *
 * Covers:
 *  - Happy path: 3 nav items (Home / Library / Swaps), no Import
 *  - A11y: primary nav has correct aria-label
 *  - Brand: logo link renders
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks ---

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
    const state = { location: { pathname: '/home' } };
    if (typeof select === 'function') return select(state);
    return state;
  },
}));

vi.mock('../../../assets/logo-mark.svg?react', () => ({
  default: () => <svg data-testid="logo-mark" aria-hidden="true" />,
}));

// ThemeToggle dependencies
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));
vi.mock('../../../api/user-settings', () => ({
  patchUserSettings: vi.fn(() => Promise.resolve({ theme: 'dark' })),
  fetchUserSettings: vi.fn(() => Promise.resolve({ theme: 'dark' })),
}));
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'hero@rathe.gg' },
    token: 'test-token',
    signOut: vi.fn(),
    setSettings: vi.fn(),
  }),
}));
vi.mock('@radix-ui/react-dropdown-menu', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children: React.ReactNode }) => (
      <button>{children}</button>
    ),
    Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Content: ({ children }: { children: React.ReactNode }) => (
      <div role="menu">{children}</div>
    ),
    Item: ({
      children,
      onSelect,
    }: {
      children: React.ReactNode;
      onSelect?: () => void;
    }) => (
      <div role="menuitem" onClick={onSelect}>
        {children}
      </div>
    ),
  };
});
vi.mock('@radix-ui/react-toggle-group', () => ({
  Root: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-toggle">{children}</div>
  ),
  Item: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`theme-toggle-${value}`}>{children}</button>
  ),
}));

import { TopBar } from '../TopBar';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TopBar — nav items', () => {
  it('renders exactly 3 nav links', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(3);
  });

  it('renders the Home nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveTextContent('Home');
  });

  it('renders the Library nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveTextContent('Library');
  });

  it('renders the Swaps nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveTextContent('Swaps');
  });

  it('does not render an Import nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).not.toHaveTextContent('Import');
  });

  it('does not render a link to /import', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const importLinks = nav.querySelectorAll('[data-to="/import"]');
    expect(importLinks).toHaveLength(0);
  });
});

describe('TopBar — A11y', () => {
  it('primary nav has aria-label="Primary"', () => {
    render(<TopBar />);
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument();
  });

  it('renders a <header> landmark', () => {
    render(<TopBar />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

describe('TopBar — brand wordmark', () => {
  it('renders the "Rathe" wordmark text', () => {
    render(<TopBar />);
    const link = screen.getByRole('link', { name: /Rathe Arsenal home/i });
    expect(link).toHaveTextContent('Rathe');
  });

  it('renders the "Arsenal" wordmark text', () => {
    render(<TopBar />);
    const link = screen.getByRole('link', { name: /Rathe Arsenal home/i });
    expect(link).toHaveTextContent('Arsenal');
  });
});

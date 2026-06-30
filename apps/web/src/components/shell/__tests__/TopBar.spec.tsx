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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

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

// VariantQueuePill — self-hiding; mock it so tests don't need the variant-jobs API
vi.mock('../../variant-queue/VariantQueuePill', () => ({
  VariantQueuePill: () => null,
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
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(3);
  });

  it('renders the Home nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav).toHaveTextContent('Início');
  });

  it('renders the Library nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav).toHaveTextContent('Biblioteca');
  });

  it('renders the Swaps nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav).toHaveTextContent('Trocas');
  });

  it('does not render an Import nav link', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav).not.toHaveTextContent('Import');
  });

  it('does not render a link to /import', () => {
    render(<TopBar />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const importLinks = nav.querySelectorAll('[data-to="/import"]');
    expect(importLinks).toHaveLength(0);
  });
});

describe('TopBar — A11y', () => {
  it('primary nav has aria-label="Primary"', () => {
    render(<TopBar />);
    expect(
      screen.getByRole('navigation', { name: 'Principal' }),
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
    const link = screen.getByRole('link', { name: /Rathe Arsenal início/i });
    expect(link).toHaveTextContent('Rathe');
  });

  it('renders the "Arsenal" wordmark text', () => {
    render(<TopBar />);
    const link = screen.getByRole('link', { name: /Rathe Arsenal início/i });
    expect(link).toHaveTextContent('Arsenal');
  });
});

// ---------------------------------------------------------------------------
// T10 (UXUI-05): .brandRathe must use solid var(--ra-accent), no gradient clip.
// Tests read TopBar.module.css directly (jsdom cannot apply CSS Modules).
// ---------------------------------------------------------------------------

describe('TopBar — .brandRathe solid brass wordmark (T10 / UXUI-05)', () => {
  const css = fs.readFileSync(
    path.join(SRC_ROOT, 'components/shell/TopBar.module.css'),
    'utf-8',
  );

  it('.brandRathe uses var(--ra-accent) for color', () => {
    const re = /\.brandRathe\s*\{[^}]*color\s*:\s*var\(--ra-accent\)/s;
    expect(re.test(css)).toBe(true);
  });

  it('.brandRathe does NOT use background-clip: text', () => {
    expect(css).not.toMatch(/background-clip\s*:\s*text/);
  });

  it('.brandRathe does NOT set color: transparent', () => {
    // gradient-clip pattern requires transparent text color; should be gone
    const CLIP_BLOCK = /\.brandRathe\s*\{[^}]*color\s*:\s*transparent/s;
    expect(CLIP_BLOCK.test(css)).toBe(false);
  });
});

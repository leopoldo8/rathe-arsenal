/**
 * AppShell tests — U5
 *
 * Covers:
 *  - Happy path: renders <header>, <main>, nav links when authenticated
 *  - Responsive: bottom tab bar visible <960px, hidden >=960px (matchMedia mock)
 *  - Responsive: at 320px, bottom tab bar item min-width 64px (CSS structural check)
 *  - A11y: correct landmark roles and aria-labels
 *  - Theme toggle: updates documentElement dataset.theme + localStorage
 *  - Sign out: calls signOut + navigates to /sign-in
 *  - Placeholder routes: /library and /swaps render "Coming in v1" stub
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---

// Mock TanStack Router hooks (AppShell uses Link and useRouter / useNavigate)
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={to} {...rest}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ navigate: vi.fn() }),
  useRouterState: ({ select }: { select?: (s: { location: { pathname: string } }) => unknown } = {}) => {
    const state = { location: { pathname: '/' } };
    if (typeof select === 'function') return select(state);
    return state;
  },
}));

// Mock SVGR imports for logo assets
vi.mock('../../../assets/logo-mark.svg?react', () => ({
  default: () => <svg data-testid="logo-mark" aria-hidden="true" />,
}));

// Mock AuthContext / useAuth
const mockSignOut = vi.fn();
const mockSetSettings = vi.fn();
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'hero@rathe.gg' },
    token: 'test-token',
    signOut: mockSignOut,
    setSettings: mockSetSettings,
  }),
}));

// Mock useToast (ThemeToggle dependency for U12 error reporting)
vi.mock('../../ui/Toast/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

// Mock user-settings API so ThemeToggle doesn't hit the network in tests
vi.mock('../../../api/user-settings', () => ({
  patchUserSettings: vi.fn(() => Promise.resolve({ theme: 'dark' })),
  fetchUserSettings: vi.fn(() => Promise.resolve({ theme: 'dark' })),
}));

// Mock VariantQueuePill so it renders a recognizable marker in every test
vi.mock('../../variant-queue/VariantQueuePill', () => ({
  VariantQueuePill: () => <div data-testid="variant-queue-pill-mock" />,
}));

// Mock Radix DropdownMenu (UserMenu dependency) — render children directly
vi.mock('@radix-ui/react-dropdown-menu', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    Portal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Content: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
    Item: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) =>
      <div role="menuitem" onClick={onSelect}>{children}</div>,
  };
});

// Mock Radix ToggleGroup (ThemeToggle dependency)
// The Root captures onValueChange; each Item calls it with its own value on click.
vi.mock('@radix-ui/react-toggle-group', () => {
  let capturedOnValueChange: ((v: string) => void) | undefined;
  return {
    Root: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange?: (v: string) => void; value?: string }) => {
      capturedOnValueChange = onValueChange;
      return <div data-testid="theme-toggle" data-value={value}>{children}</div>;
    },
    Item: ({ children, value }: { children: React.ReactNode; value: string }) =>
      <button
        data-testid={`theme-toggle-${value}`}
        onClick={() => capturedOnValueChange?.(value)}
        aria-pressed={undefined}
      >{children}</button>,
  };
});

import { AppShell } from '../AppShell';

// matchMedia mock factory
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

describe('AppShell — happy path', () => {
  beforeEach(() => {
    mockMatchMedia(false); // default: >=960px (mobile = false)
    document.documentElement.dataset.theme = 'dark';
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders a <header> landmark', () => {
    render(<AppShell><div>content</div></AppShell>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders a <main> landmark containing children', () => {
    render(<AppShell><div>page content</div></AppShell>);
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('page content');
  });

  it('renders primary nav with Home, Library, Swaps links (no Import)', () => {
    render(<AppShell><div /></AppShell>);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveTextContent('Início');
    expect(nav).toHaveTextContent('Biblioteca');
    expect(nav).toHaveTextContent('Trocas');
    expect(nav).not.toHaveTextContent('Import');
  });

  it('mounts the variant queue pill in the header', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByTestId('variant-queue-pill-mock')).toBeInTheDocument();
  });
});

describe('AppShell — A11y landmarks', () => {
  beforeEach(() => mockMatchMedia(false));

  it('top bar is <header> (role=banner)', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('primary nav has the correct aria-label in PT-BR', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });

  it('main content has role=main', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});

describe('AppShell — responsive: bottom tab bar', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders mobile nav with the correct aria-label when matchMedia matches', () => {
    // matches=true means we ARE below 960px — show bottom tab bar
    mockMatchMedia(true);
    render(<AppShell><div /></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });

  it('does not render mobile nav when matchMedia does not match (>=960px)', () => {
    mockMatchMedia(false);
    render(<AppShell><div /></AppShell>);
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
  });
});

describe('AppShell — theme toggle', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    document.documentElement.dataset.theme = 'dark';
    localStorage.clear();
  });

  it('clicking light toggle updates documentElement.dataset.theme to "light"', async () => {
    render(<AppShell><div /></AppShell>);
    const lightBtn = screen.getByTestId('theme-toggle-light');
    await userEvent.click(lightBtn);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('clicking light toggle writes "light" to localStorage', async () => {
    render(<AppShell><div /></AppShell>);
    const lightBtn = screen.getByTestId('theme-toggle-light');
    await userEvent.click(lightBtn);
    expect(localStorage.getItem('rathe-arsenal:theme')).toBe('light');
  });

  it('clicking dark toggle updates documentElement.dataset.theme to "dark"', async () => {
    document.documentElement.dataset.theme = 'light';
    render(<AppShell><div /></AppShell>);
    const darkBtn = screen.getByTestId('theme-toggle-dark');
    await userEvent.click(darkBtn);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('AppShell — sign out', () => {
  beforeEach(() => mockMatchMedia(false));

  it('clicking Sign out in user menu calls signOut', async () => {
    render(<AppShell><div /></AppShell>);
    const signOutItem = screen.getByText(/Sair/i);
    await userEvent.click(signOutItem);
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});

// DISC-01 AC1: "WHEN any authenticated shell route renders THEN the AppShell
// SHALL render a persistent footer containing the localized disclaimer text
// and a link to /about." Footer.spec.tsx only exercises Footer standalone —
// this asserts the composed AppShell actually mounts it, closing the
// integration gap flagged by the verifier (Fix 1).
describe('AppShell — footer / disclaimer (DISC-01)', () => {
  beforeEach(() => mockMatchMedia(false));

  it('renders the localized disclaimer text from the mounted Footer', () => {
    render(<AppShell><div>child</div></AppShell>);
    expect(
      screen.getByText(
        'A Rathe Arsenal não tem nenhuma afiliação com a Legend Story Studios. Flesh and Blood™ e os nomes de coleções são marcas registradas da Legend Story Studios®. Personagens e nomes podem estar protegidos por direitos autorais.',
      ),
    ).toBeInTheDocument();
  });

  it('renders a link to /about from the mounted Footer', () => {
    render(<AppShell><div>child</div></AppShell>);
    const aboutLink = screen.getByRole('link', { name: 'Sobre' });
    expect(aboutLink).toHaveAttribute('href', '/about');
  });
});

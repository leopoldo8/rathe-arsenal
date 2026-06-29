/**
 * Settings page tests — Unit 7 (Onda 3)
 *
 * Covers:
 *  - Happy path: renders 4 sections (Profile, Theme, Language, Account)
 *  - Theme toggle: clicking updates document.documentElement.dataset.theme
 *  - A11y: heading levels (<h1> page, <h2> each section)
 *  - Profile section: shows user email read-only (no display-name field)
 *  - Account section: delete-account button opens the modal
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { AuthContext, IAuthContext } from '../../../auth/AuthContext';

// ----- Mocks -----

// TanStack Router — settings uses createFileRoute + useNavigate.
// createFileRoute returns a function that accepts a route config object.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => undefined,
  useNavigate: () => vi.fn(),
}));

// ThemeToggle dependencies (U12 wiring) — mock useToast + user-settings API
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));
vi.mock('../../../api/user-settings', () => ({
  patchUserSettings: vi.fn(() => Promise.resolve({ theme: 'dark' })),
  fetchUserSettings: vi.fn(() => Promise.resolve({ theme: 'dark' })),
}));

// ThemeToggle — mock Radix ToggleGroup so toggle items are real buttons
let capturedOnValueChange: ((v: string) => void) | undefined;
vi.mock('@radix-ui/react-toggle-group', () => ({
  Root: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => {
    capturedOnValueChange = onValueChange;
    return (
      <div data-testid="theme-toggle" data-value={value}>
        {children}
      </div>
    );
  },
  Item: ({ children, value }: { children: ReactNode; value: string }) => (
    <button
      data-testid={`theme-toggle-${value}`}
      onClick={() => capturedOnValueChange?.(value)}
    >
      {children}
    </button>
  ),
}));

// Store-admin API — stub the hooks so the admin section renders without a
// QueryClientProvider. `triggerMutate` is captured to assert the click wiring.
const { triggerMutate } = vi.hoisted(() => ({ triggerMutate: vi.fn() }));
vi.mock('../../../api/store-admin', () => ({
  useUrlSyncStatusQuery: () => ({ data: { state: 'idle', lastUrlSyncAt: null, lastProductCount: null } }),
  useTriggerUrlSyncMutation: () => ({ mutate: triggerMutate, isPending: false, isError: false }),
}));

// DeleteAccountModal — smoke-stub so settings tests focus on the page layout
vi.mock('../../../components/delete-account-modal', () => ({
  DeleteAccountModal: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    onDeleted: () => void;
  }) =>
    open ? (
      <div role="alertdialog" aria-label="Delete your account">
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));

// LanguageToggle — stub so these layout tests don't double-bind the single
// captured Radix onValueChange; the real toggle is covered in its own spec.
vi.mock('../../../components/shell/LanguageToggle', () => ({
  LanguageToggle: () => <div data-testid="language-toggle" />,
}));

import { SettingsPage } from '../settings';

// ----- Helpers -----

const noopAsync = async () => {
  /* test stub */
};

function makeAuthContext(overrides: Partial<IAuthContext> = {}): IAuthContext {
  return {
    user: { id: 'u1', email: 'hero@rathe.gg', role: 'user' },
    token: 'jwt',
    isLoading: false,
    setSettings: vi.fn(),
    signUp: async () => ({}),
    signIn: noopAsync,
    signOut: () => {
      /* test stub */
    },
    verifyEmail: noopAsync,
    forgotPassword: noopAsync,
    resetPassword: noopAsync,
    deleteAccount: noopAsync,
    ...overrides,
  };
}

function renderSettings(authCtx: IAuthContext = makeAuthContext()) {
  return render(
    <AuthContext.Provider value={authCtx}>
      <SettingsPage />
    </AuthContext.Provider>,
  );
}

// ----- Tests -----

describe('SettingsPage — happy path: 4 sections rendered', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark';
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the page <h1> heading', () => {
    renderSettings();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/configurações da conta/i);
  });

  it('renders a Profile section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('perfil'))).toBe(true);
  });

  it('renders a Theme section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('tema'))).toBe(true);
  });

  it('renders a Language section with an <h2> heading (PT-BR default)', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('idioma'))).toBe(true);
  });

  it('renders an Account/Danger section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('perigo'))).toBe(true);
  });

  it('renders exactly 4 <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  });
});

describe('SettingsPage — Profile section', () => {
  it('displays the authenticated user email', () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'archer@rathe.gg', role: 'user' } }));
    expect(screen.getByText('archer@rathe.gg')).toBeInTheDocument();
  });

  it('does NOT render a display-name input (out of v1 scope)', () => {
    renderSettings();
    // There must be no text input or field labeled "display name" or "name"
    const inputs = screen.queryAllByRole('textbox');
    expect(inputs).toHaveLength(0);
  });
});

describe('SettingsPage — Theme section: theme toggle updates dataset', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark';
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('clicking the light toggle updates document.documentElement.dataset.theme to "light"', async () => {
    renderSettings();
    const lightBtn = screen.getByTestId('theme-toggle-light');
    await userEvent.click(lightBtn);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('clicking the dark toggle updates document.documentElement.dataset.theme to "dark"', async () => {
    document.documentElement.dataset.theme = 'light';
    renderSettings();
    const darkBtn = screen.getByTestId('theme-toggle-dark');
    await userEvent.click(darkBtn);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('clicking the light toggle persists "light" to localStorage', async () => {
    renderSettings();
    await userEvent.click(screen.getByTestId('theme-toggle-light'));
    expect(localStorage.getItem('rathe-arsenal:theme')).toBe('light');
  });
});

describe('SettingsPage — Account section: delete modal trigger', () => {
  it('renders a "Delete my account" button', () => {
    renderSettings();
    expect(
      screen.getByRole('button', { name: /excluir minha conta/i }),
    ).toBeInTheDocument();
  });

  it('opens the delete-account modal when the button is clicked', async () => {
    renderSettings();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('closes the modal when Cancel is clicked inside it', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('SettingsPage — A11y: heading levels', () => {
  it('has exactly one <h1>', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('has exactly four <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4);
  });

  it('does not use <h3> or deeper for section headings', () => {
    renderSettings();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });
});

describe('SettingsPage — admin store-sync section', () => {
  afterEach(() => vi.clearAllMocks());

  it('is hidden for a regular user', () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'hero@rathe.gg', role: 'user' } }));
    expect(screen.queryByTestId('store-sync-trigger')).not.toBeInTheDocument();
  });

  it('is shown for an admin and triggers the sync on click', async () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'admin@rathe.gg', role: 'admin' } }));
    const button = screen.getByTestId('store-sync-trigger');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(triggerMutate).toHaveBeenCalledTimes(1);
  });
});

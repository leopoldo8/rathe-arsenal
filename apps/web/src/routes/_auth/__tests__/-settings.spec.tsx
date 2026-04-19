/**
 * Settings page tests — Unit 7 (Onda 3)
 *
 * Covers:
 *  - Happy path: renders 3 sections (Profile, Theme, Account)
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

import { SettingsPage } from '../settings';

// ----- Helpers -----

const noopAsync = async () => {
  /* test stub */
};

function makeAuthContext(overrides: Partial<IAuthContext> = {}): IAuthContext {
  return {
    user: { id: 'u1', email: 'hero@rathe.gg' },
    token: 'jwt',
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

describe('SettingsPage — happy path: 3 sections rendered', () => {
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
    expect(h1).toHaveTextContent(/account settings/i);
  });

  it('renders a Profile section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('profile'))).toBe(true);
  });

  it('renders a Theme section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('theme'))).toBe(true);
  });

  it('renders an Account/Danger section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('danger'))).toBe(true);
  });

  it('renders exactly 3 <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });
});

describe('SettingsPage — Profile section', () => {
  it('displays the authenticated user email', () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'archer@rathe.gg' } }));
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
      screen.getByRole('button', { name: /delete my account/i }),
    ).toBeInTheDocument();
  });

  it('opens the delete-account modal when the button is clicked', async () => {
    renderSettings();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('closes the modal when Cancel is clicked inside it', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /delete my account/i }));
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

  it('has exactly three <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('does not use <h3> or deeper for section headings', () => {
    renderSettings();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });
});

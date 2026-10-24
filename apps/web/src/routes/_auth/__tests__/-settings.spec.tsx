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
const { triggerMutate, syncStatus, IDLE_SYNC_STATUS } = vi.hoisted(() => {
  const idle: Record<string, unknown> = { state: 'idle', lastUrlSyncAt: null, lastProductCount: null, lastError: null };
  return { triggerMutate: vi.fn(), syncStatus: { current: idle }, IDLE_SYNC_STATUS: idle };
});
vi.mock('../../../api/store-admin', () => ({
  useUrlSyncStatusQuery: () => ({ data: syncStatus.current }),
  useTriggerUrlSyncMutation: () => ({ mutate: triggerMutate, isPending: false, isError: false }),
}));

// Display-name PATCH (sharing) — stubbed so the field is tested without a network.
const { patchDisplayNameMock } = vi.hoisted(() => ({ patchDisplayNameMock: vi.fn() }));
const { patchContactMock } = vi.hoisted(() => ({ patchContactMock: vi.fn() }));
vi.mock('../../../api/shared-decks', () => ({ patchDisplayName: patchDisplayNameMock, patchContact: patchContactMock }));

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
import settingsStyles from '../settings.module.css';

function cls(name: string | undefined): string {
  if (!name) throw new Error('css module class is missing');
  return name;
}

// ----- Helpers -----

const noopAsync = async () => {
  /* test stub */
};

function makeAuthContext(overrides: Partial<IAuthContext> = {}): IAuthContext {
  return {
    user: { id: 'u1', email: 'hero@rathe.gg', role: 'user', chatAccess: false },
    isLoading: false,
    setSettings: vi.fn(),
    signUp: async () => undefined,
    signIn: noopAsync,
    signOut: () => {
      /* test stub */
    },
    verifyEmail: noopAsync,
    verifyCode: async () => ({ returnPath: null }),
    redeemCode: async () => ({ returnPath: null }),
    deleteAccount: noopAsync,
    setDisplayName: () => undefined,
    setWhatsappNumber: () => undefined,
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

  it('renders an Appearance section with an <h2> heading', () => {
    renderSettings();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    const labels = sectionHeadings.map((h) => h.textContent?.toLowerCase() ?? '');
    expect(labels.some((t) => t.includes('aparência'))).toBe(true);
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
    expect(labels.some((t) => t.includes('excluir conta'))).toBe(true);
  });

  it('renders exactly 5 <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5);
  });

  it('wraps the panels in the capped, centred page column', () => {
    const { container } = renderSettings();
    expect(container.firstElementChild).toHaveClass(cls(settingsStyles.page));
  });

  it('draws each of the four panels with the section class and no eyebrow above its heading', () => {
    renderSettings();
    const panels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.closest('section'));
    expect(panels).toHaveLength(5);
    for (const panel of panels) {
      expect(panel).toHaveClass(cls(settingsStyles.section));
      expect(panel?.querySelector('span[class*="eyebrow"]')).toBeNull();
    }
  });

  it('marks only the danger-zone panel with the account (danger) class', () => {
    renderSettings();
    const panels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.closest('section'));
    const flagged = panels.filter((p) => p?.classList.contains(cls(settingsStyles.accountSection)));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveTextContent(/excluir conta/i);
  });

  it('keeps both toggles inside their own panels', () => {
    renderSettings();
    const theme = screen.getByRole('heading', { level: 2, name: /aparência/i }).closest('section');
    const language = screen.getByRole('heading', { level: 2, name: /idioma/i }).closest('section');
    expect(theme?.querySelector('[data-testid^="theme-toggle"]')).not.toBeNull();
    expect(language?.querySelector('[data-testid^="language-toggle"]')).not.toBeNull();
  });
});

describe('SettingsPage — Profile section', () => {
  beforeEach(() => patchDisplayNameMock.mockReset());

  it('displays the authenticated user email', () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'archer@rathe.gg', role: 'user', chatAccess: false } }));
    expect(screen.getByText('archer@rathe.gg')).toBeInTheDocument();
  });

  it('renders the display-name field inside the profile panel, prefilled from the user', () => {
    renderSettings(
      makeAuthContext({
        user: { id: 'u1', email: 'hero@rathe.gg', role: 'user', chatAccess: false, displayName: 'Dudu_Pelotas' },
      }),
    );
    const input = screen.getByRole('textbox', { name: /seu nome para outros jogadores/i });
    expect(input).toHaveValue('Dudu_Pelotas');
    expect(input.closest('section')).toBe(screen.getByRole('heading', { level: 2, name: /perfil/i }).closest('section'));
  });

  it('saves the trimmed display name with PATCH and mirrors it into the auth context', async () => {
    patchDisplayNameMock.mockResolvedValueOnce({ displayName: 'Dudu' });
    const setDisplayName = vi.fn();
    renderSettings(makeAuthContext({ setDisplayName }));
    await userEvent.type(screen.getByRole('textbox', { name: /seu nome para outros jogadores/i }), '  Dudu  ');
    await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
    expect(patchDisplayNameMock).toHaveBeenCalledWith('Dudu');
    expect(setDisplayName).toHaveBeenCalledWith('Dudu');
    expect(await screen.findByText(/nome salvo/i)).toBeInTheDocument();
  });

  it('does not send a name shorter than 2 characters', async () => {
    renderSettings();
    await userEvent.type(screen.getByRole('textbox', { name: /seu nome para outros jogadores/i }), 'D');
    await userEvent.click(screen.getByRole('button', { name: /^salvar$/i }));
    expect(patchDisplayNameMock).not.toHaveBeenCalled();
  });
});

describe('SettingsPage — Contact panel (WhatsApp)', () => {
  beforeEach(() => patchContactMock.mockReset());

  const saved = makeAuthContext({
    user: { id: 'u1', email: 'hero@rathe.gg', role: 'user', chatAccess: false, displayName: 'Dudu', whatsappNumber: '5553999990000' },
  });

  it('shows the saved number without the country code and "Remover número"', () => {
    renderSettings(saved);
    const panel = screen.getByRole('heading', { level: 2, name: /seu whatsapp/i }).closest('section')!;
    expect(panel.querySelector('input[type="tel"]')).toHaveValue('53 99999-0000');
    expect(screen.getByRole('button', { name: 'Remover número' })).toBeInTheDocument();
  });

  it('has no remove button while no number is saved', () => {
    renderSettings();
    expect(screen.queryByRole('button', { name: 'Remover número' })).not.toBeInTheDocument();
  });

  it('saves a number with PATCH and mirrors it into the auth context', async () => {
    patchContactMock.mockResolvedValueOnce({ whatsappNumber: '5553999990000' });
    const setWhatsappNumber = vi.fn();
    renderSettings(makeAuthContext({ setWhatsappNumber }));
    await userEvent.type(screen.getByLabelText('WhatsApp (opcional)'), '53 99999-0000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar número' }));
    expect(patchContactMock).toHaveBeenCalledWith('53 99999-0000');
    expect(setWhatsappNumber).toHaveBeenCalledWith('5553999990000');
    expect(await screen.findByText('Número salvo.')).toBeInTheDocument();
  });

  it('shows the hint for an incomplete number without calling the API', async () => {
    renderSettings();
    await userEvent.type(screen.getByLabelText('WhatsApp (opcional)'), '53 9999');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar número' }));
    expect(await screen.findByText(/Número inválido/)).toBeInTheDocument();
    expect(patchContactMock).not.toHaveBeenCalled();
  });

  it('removes the number by sending null', async () => {
    patchContactMock.mockResolvedValueOnce({ whatsappNumber: null });
    const setWhatsappNumber = vi.fn();
    renderSettings({ ...saved, setWhatsappNumber });
    await userEvent.click(screen.getByRole('button', { name: 'Remover número' }));
    expect(patchContactMock).toHaveBeenCalledWith(null);
    expect(setWhatsappNumber).toHaveBeenCalledWith(null);
    expect(await screen.findByText('Número removido.')).toBeInTheDocument();
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
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5);
  });

  it('does not use <h3> or deeper for section headings', () => {
    renderSettings();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });
});

describe('SettingsPage — admin store-sync section', () => {
  const admin = makeAuthContext({ user: { id: 'u1', email: 'admin@rathe.gg', role: 'admin', chatAccess: false } });
  const rateLimitFailure = {
    message: 'Fetch failed for page=11: Firecrawl returned HTTP 429: Rate limit exceeded',
    at: '2026-10-04T16:00:13.000Z',
  };

  beforeEach(() => {
    syncStatus.current = IDLE_SYNC_STATUS;
  });

  afterEach(() => vi.clearAllMocks());

  it('is hidden for a regular user', () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'hero@rathe.gg', role: 'user', chatAccess: false } }));
    expect(screen.queryByTestId('store-sync-trigger')).not.toBeInTheDocument();
  });

  it('is shown for an admin and triggers the sync on click', async () => {
    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'admin@rathe.gg', role: 'admin', chatAccess: false } }));
    const button = screen.getByTestId('store-sync-trigger');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(triggerMutate).toHaveBeenCalledTimes(1);
  });

  it('shows why the last sync failed once it is idle again', () => {
    syncStatus.current = { ...IDLE_SYNC_STATUS, lastError: rateLimitFailure };
    renderSettings(admin);
    expect(screen.getByTestId('store-sync-failure')).toHaveTextContent(
      'Firecrawl returned HTTP 429: Rate limit exceeded',
    );
  });

  it('hides the previous failure while a new sync is running', () => {
    syncStatus.current = { ...IDLE_SYNC_STATUS, state: 'running', lastError: rateLimitFailure };
    renderSettings(admin);
    expect(screen.queryByTestId('store-sync-failure')).not.toBeInTheDocument();
  });

  it('shows no failure when the last sync succeeded', () => {
    renderSettings(admin);
    expect(screen.queryByTestId('store-sync-failure')).not.toBeInTheDocument();
  });
});

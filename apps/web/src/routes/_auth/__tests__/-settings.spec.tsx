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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode, useState } from 'react';
import { AuthContext, IAuthContext, type IAuthUser } from '../../../auth/AuthContext';

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
const { triggerMutate, syncStatus, IDLE_SYNC_STATUS, credits } = vi.hoisted(() => {
  const idle: Record<string, unknown> = { state: 'idle', lastUrlSyncAt: null, lastProductCount: null, lastError: null };
  return {
    triggerMutate: vi.fn(),
    syncStatus: { current: idle },
    IDLE_SYNC_STATUS: idle,
    credits: { current: { creditsUsed: 120, budget: 1000, lookupsStopped: false } as Record<string, unknown> | undefined },
  };
});
vi.mock('../../../api/store-admin', () => ({
  useUrlSyncStatusQuery: () => ({ data: syncStatus.current }),
  useCreditsQuery: () => ({ data: credits.current }),
  useTriggerUrlSyncMutation: () => ({ mutate: triggerMutate, isPending: false, isError: false }),
}));

// The spare-rule panel reads the spare count; with no data it renders nothing, so this page spec needs no QueryClientProvider.
vi.mock('../../../api/spare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/spare')>()),
  useSpareQuery: () => ({ data: undefined }),
}));

// Display-name PATCH (sharing) — stubbed so the field is tested without a network.
const { patchDisplayNameMock } = vi.hoisted(() => ({ patchDisplayNameMock: vi.fn() }));
const { patchContactMock } = vi.hoisted(() => ({ patchContactMock: vi.fn() }));
vi.mock('../../../api/shared-decks', () => ({ patchDisplayName: patchDisplayNameMock, patchContact: patchContactMock }));

// Password PUT — stubbed so the form is tested without a network.
const { setAccountPasswordMock, requestPasswordCodeMock } = vi.hoisted(() => ({
  setAccountPasswordMock: vi.fn(),
  requestPasswordCodeMock: vi.fn(),
}));
vi.mock('../../../lib/account-api', () => ({
  setAccountPassword: setAccountPasswordMock,
  requestPasswordCode: requestPasswordCodeMock,
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
    verifyEmail: async () => ({ returnPath: null, email: '' }),
    changeEmail: async () => undefined,
    verifyCode: async () => ({ returnPath: null }),
    redeemCode: async () => ({ returnPath: null }),
    deleteAccount: noopAsync,
    setDisplayName: () => undefined,
    setWhatsappNumber: () => undefined,
    setHasPassword: () => undefined,
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

  it('renders exactly 6 <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
  });

  it('wraps the panels in the capped, centred page column', () => {
    const { container } = renderSettings();
    expect(container.firstElementChild).toHaveClass(cls(settingsStyles.page));
  });

  it('draws each of the four panels with the section class and no eyebrow above its heading', () => {
    renderSettings();
    const panels = screen.getAllByRole('heading', { level: 2 }).map((h) => h.closest('section'));
    expect(panels).toHaveLength(6);
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

  it('has exactly six <h2> section headings', () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
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
    credits.current = { creditsUsed: 120, budget: 1000, lookupsStopped: false };
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

  it('the credits bar sits under the sync line and turns amber when lookups stop', () => {
    const follows = (before: HTMLElement, after: HTMLElement): boolean =>
      Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
    const fillOf = (meter: HTMLElement): SVGRectElement => meter.querySelector('rect') as SVGRectElement;

    credits.current = { creditsUsed: 120, budget: 1000, lookupsStopped: false };
    const running = renderSettings(admin);
    const label = screen.getByText('Créditos do Firecrawl este mês');
    const numbers = screen.getByText('120 de 1000');
    const meter = screen.getByRole('img', { name: '120 de 1000 créditos usados' });
    expect(follows(screen.getByTestId('store-sync-status'), label)).toBe(true);
    expect(follows(label, numbers)).toBe(true);
    expect(follows(numbers, meter)).toBe(true);
    expect(fillOf(meter)).toHaveAttribute('width', '12%');
    expect(meter).not.toHaveClass(cls(settingsStyles.meterStopped));
    expect(screen.queryByText('As consultas automáticas de preço pararam.')).not.toBeInTheDocument();
    expect(screen.queryByText('A sincronização manual continua funcionando.')).not.toBeInTheDocument();
    running.unmount();

    credits.current = { creditsUsed: 880, budget: 1000, lookupsStopped: true };
    renderSettings(admin);
    const stoppedMeter = screen.getByRole('img', { name: '880 de 1000 créditos usados' });
    expect(fillOf(stoppedMeter)).toHaveAttribute('width', '88%');
    expect(stoppedMeter).toHaveClass(cls(settingsStyles.meterStopped));
    const stopLine = screen.getByText('As consultas automáticas de preço pararam.');
    expect(follows(stoppedMeter, stopLine)).toBe(true);
    expect(follows(stopLine, screen.getByText('A sincronização manual continua funcionando.'))).toBe(true);
  });

  it("the URL sync section shows the month's credits and when lookups stopped", () => {
    credits.current = { creditsUsed: 120, budget: 1000, lookupsStopped: false };
    const { unmount } = renderSettings(admin);
    const section = screen.getByTestId('store-sync-trigger').closest('section') as HTMLElement;
    expect(within(section).getByText('Créditos do Firecrawl este mês')).toBeInTheDocument();
    expect(within(section).getByText('120 de 1000')).toBeInTheDocument();
    expect(within(section).getByRole('img', { name: '120 de 1000 créditos usados' })).toBeInTheDocument();
    expect(within(section).queryByText('As consultas automáticas de preço pararam.')).not.toBeInTheDocument();
    unmount();

    credits.current = { creditsUsed: 880, budget: 1000, lookupsStopped: true };
    const stopped = renderSettings(admin);
    const stoppedSection = screen.getByTestId('store-sync-trigger').closest('section') as HTMLElement;
    expect(within(stoppedSection).getByText('880 de 1000')).toBeInTheDocument();
    expect(within(stoppedSection).getByText('As consultas automáticas de preço pararam.')).toBeInTheDocument();
    expect(within(stoppedSection).getByText('A sincronização manual continua funcionando.')).toBeInTheDocument();
    stopped.unmount();

    renderSettings(makeAuthContext({ user: { id: 'u1', email: 'hero@rathe.gg', role: 'user', chatAccess: false } }));
    expect(screen.queryByText('Créditos do Firecrawl este mês')).not.toBeInTheDocument();
    expect(screen.queryByText('As consultas automáticas de preço pararam.')).not.toBeInTheDocument();
  });
});

describe('SettingsPage, Conta section: the password', () => {
  const account = (hasPassword: boolean): IAuthUser => ({
    id: 'u1',
    email: 'lucas.prado@hotmail.com',
    role: 'user',
    chatAccess: false,
    hasPassword,
  });

  function contaSection(): HTMLElement {
    return screen.getByRole('heading', { level: 2, name: 'Conta' }).closest('section')!;
  }

  function renderWithState(initial: IAuthUser) {
    function Harness(): React.ReactElement {
      const [user, setUser] = useState(initial);
      const ctx = makeAuthContext({ user, setHasPassword: (hasPassword) => setUser((prev) => ({ ...prev, hasPassword })) });
      return (
        <AuthContext.Provider value={ctx}>
          <SettingsPage />
        </AuthContext.Provider>
      );
    }
    return render(<Harness />);
  }

  const askedCode = (): { expiresAt: string; resendAfter: string } => ({
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    resendAfter: new Date(Date.now() + 45 * 1000).toISOString(),
  });

  beforeEach(() => {
    setAccountPasswordMock.mockReset().mockResolvedValue(undefined);
    requestPasswordCodeMock.mockReset().mockImplementation(async () => askedCode());
  });

  async function typeCode(digits: string): Promise<void> {
    const boxes = within(contaSection()).getAllByLabelText(/^Dígito \d de 6$/);
    for (const [index, digit] of [...digits].entries()) await userEvent.type(boxes[index]!, digit);
  }

  const follows = (first: Node, second: Node): boolean => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('the password row follows hasPassword', () => {
    const withPassword = renderSettings(makeAuthContext({ user: account(true) }));
    let section = within(contaSection());
    const order = [
      section.getByText('E-mail'),
      section.getByText('lucas.prado@hotmail.com'),
      section.getByText('Senha: você tem uma senha'),
      section.getByRole('button', { name: 'Mudar a senha' }),
      section.getByText('Você também pode entrar com um código por e-mail, sem senha.'),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(section.queryByRole('button', { name: 'Criar uma senha' })).not.toBeInTheDocument();
    withPassword.unmount();

    renderSettings(makeAuthContext({ user: account(false) }));
    section = within(contaSection());
    expect(section.getByText('Senha: nenhuma')).toBeInTheDocument();
    expect(section.getByRole('button', { name: 'Criar uma senha' })).toBeInTheDocument();
    expect(section.queryByRole('button', { name: 'Mudar a senha' })).not.toBeInTheDocument();
  });

  it('a new password asks only the new password', async () => {
    // The real client functions run: what leaves the browser is the request, so the request is what is asserted.
    const actual = await vi.importActual<typeof import('../../../lib/account-api')>('../../../lib/account-api');
    requestPasswordCodeMock.mockImplementation(() => actual.requestPasswordCode());
    setAccountPasswordMock.mockImplementation((code: string, password: string) => actual.setAccountPassword(code, password));
    const fetchMock = vi.fn(async (url: string) =>
      url === '/api/users/me/password-code'
        ? new Response(JSON.stringify(askedCode()), { status: 202, headers: { 'Content-Type': 'application/json' } })
        : new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    for (const [hasPassword, opener] of [
      [false, 'Criar uma senha'],
      [true, 'Mudar a senha'],
    ] as const) {
      fetchMock.mockClear();
      const view = renderWithState(account(hasPassword));

      await userEvent.click(within(contaSection()).getByRole('button', { name: opener }));
      expect(await within(contaSection()).findByText(/Mandamos para/)).toBeInTheDocument();
      expect(contaSection().querySelector('input[type="password"]'), 'the code step has no password input').toBeNull();
      await typeCode('482913');
      const form = contaSection().querySelector('form')!;
      expect(form.querySelectorAll('input[type="password"]'), `${opener} opens one password input`).toHaveLength(1);
      expect(form.querySelector('input[autocomplete="current-password"]')).toBeNull();
      expect(within(form).queryByLabelText(/atual/i)).toBeNull();

      await userEvent.type(within(form).getByLabelText('Nova senha'), '0123456789');
      await userEvent.click(within(form).getByRole('button', { name: 'Salvar senha' }));

      expect(await within(contaSection()).findByText('Senha: você tem uma senha')).toBeInTheDocument();
      expect(contaSection().querySelector('form')).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [codeUrl, codeInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(codeUrl).toBe('/api/users/me/password-code');
      expect(codeInit.method).toBe('POST');
      const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
      expect(url).toBe('/api/users/me/password');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({ code: '482913', password: '0123456789' });
      view.unmount();
    }
    vi.unstubAllGlobals();
  });

  it('the password change arranges the code step and the new password step as r6-password-b-phone', async () => {
    renderWithState(account(true));
    const section = (): ReturnType<typeof within> => within(contaSection());

    await userEvent.click(section().getByRole('button', { name: 'Mudar a senha' }));

    // Frame one: the row keeps its state without the button, then the code step, then the note.
    const boxes = await section().findAllByLabelText(/^Dígito \d de 6$/);
    expect(boxes).toHaveLength(6);
    expect(boxes[0]).toHaveFocus();
    expect(section().queryByRole('button', { name: 'Mudar a senha' })).toBeNull();
    const sentTo = section().getByText(/Mandamos para/);
    expect(sentTo).toHaveTextContent('Mandamos para lucas.prado@hotmail.com. Ele vale 15 minutos.');
    expect(sentTo.querySelector('b')).toHaveTextContent('lucas.prado@hotmail.com');
    const resend = section().getByRole('button', { name: 'Reenviar em 45 s' });
    expect(resend).toHaveAttribute('aria-disabled', 'true');
    const cancel = section().getByRole('button', { name: 'Cancelar' });
    const note = section().getByText('Você também pode entrar com um código por e-mail, sem senha.');
    const order = [section().getByText('Senha: você tem uma senha'), sentTo, boxes[0]!, boxes[5]!, resend, cancel, note];
    for (let i = 1; i < order.length; i++) expect(follows(order[i - 1]!, order[i]!)).toBe(true);

    // Frame two: after the sixth digit, the new password field is focused and empty.
    await typeCode('482913');
    const field = section().getByLabelText('Nova senha');
    expect(field).toHaveFocus();
    expect(field).toHaveValue('');
    expect(section().queryByLabelText(/^Dígito/)).toBeNull();
    const hint = section().getByText('Pelo menos 10 caracteres.');
    const secondCancel = section().getByRole('button', { name: 'Cancelar' });
    const save = section().getByRole('button', { name: 'Salvar senha' });
    expect(secondCancel.parentElement).toBe(save.parentElement);
    expect(follows(secondCancel, save)).toBe(true);
    const secondOrder = [section().getByText('Senha: você tem uma senha'), field, hint, secondCancel, save, section().getByText('Você também pode entrar com um código por e-mail, sem senha.')];
    for (let i = 1; i < secondOrder.length; i++) expect(follows(secondOrder[i - 1]!, secondOrder[i]!)).toBe(true);
  });

  it('a password is set after the e-mailed code, for an account with and without one', async () => {
    for (const [hasPassword, opener, before] of [
      [false, 'Criar uma senha', 'Senha: nenhuma'],
      [true, 'Mudar a senha', 'Senha: você tem uma senha'],
    ] as const) {
      setAccountPasswordMock.mockClear();
      requestPasswordCodeMock.mockClear();
      requestPasswordCodeMock.mockImplementation(async () => ({
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        resendAfter: new Date(Date.now() + 30 * 1000).toISOString(),
      }));
      const view = renderWithState(account(hasPassword));
      expect(within(contaSection()).getByText(before)).toBeInTheDocument();

      await userEvent.click(within(contaSection()).getByRole('button', { name: opener }));

      expect(requestPasswordCodeMock).toHaveBeenCalledTimes(1);
      expect(await within(contaSection()).findByText(/Mandamos para/)).toHaveTextContent('Ele vale 10 minutos.');
      expect(within(contaSection()).getByRole('button', { name: 'Reenviar em 30 s' })).toBeInTheDocument();
      expect(setAccountPasswordMock).not.toHaveBeenCalled();

      // "Cancelar" on the code step returns to the row and asks nothing more.
      await userEvent.click(within(contaSection()).getByRole('button', { name: 'Cancelar' }));
      expect(within(contaSection()).getByText(before)).toBeInTheDocument();
      expect(within(contaSection()).getByRole('button', { name: opener })).toBeInTheDocument();

      // "Cancelar" on the second step spends no code and changes no password.
      await userEvent.click(within(contaSection()).getByRole('button', { name: opener }));
      await within(contaSection()).findByText(/Mandamos para/);
      await typeCode('123456');
      await userEvent.click(within(contaSection()).getByRole('button', { name: 'Cancelar' }));
      expect(setAccountPasswordMock).not.toHaveBeenCalled();
      expect(within(contaSection()).getByText(before)).toBeInTheDocument();

      await userEvent.click(within(contaSection()).getByRole('button', { name: opener }));
      await within(contaSection()).findByText(/Mandamos para/);
      await typeCode('654321');
      await userEvent.type(within(contaSection()).getByLabelText('Nova senha'), '0123456789');
      await userEvent.click(within(contaSection()).getByRole('button', { name: 'Salvar senha' }));

      expect(await within(contaSection()).findByText('Senha: você tem uma senha')).toBeInTheDocument();
      expect(setAccountPasswordMock).toHaveBeenCalledTimes(1);
      expect(setAccountPasswordMock).toHaveBeenCalledWith('654321', '0123456789');
      view.unmount();
    }
  });

  it('a refused code sends the player back to the code step with the reason', async () => {
    const { AuthFetchError } = await vi.importActual<typeof import('../../../lib/auth-fetch')>('../../../lib/auth-fetch');
    renderWithState(account(true));

    for (const [failure, message] of [
      [new AuthFetchError('wrong', 400, null, 'INVALID_CODE'), 'Este código não confere. Confira no e-mail.'],
      [new AuthFetchError('gone', 410, null, 'TOKEN_EXPIRED'), 'Este código venceu. Ele vale 15 minutos.'],
    ] as const) {
      setAccountPasswordMock.mockRejectedValueOnce(failure);
      await userEvent.click(within(contaSection()).getByRole('button', { name: 'Mudar a senha' }));
      await within(contaSection()).findByText(/Mandamos para/);
      await typeCode('111111');
      await userEvent.type(within(contaSection()).getByLabelText('Nova senha'), '0123456789');
      await userEvent.click(within(contaSection()).getByRole('button', { name: 'Salvar senha' }));

      expect(await within(contaSection()).findByRole('alert')).toHaveTextContent(message);
      expect(within(contaSection()).getAllByLabelText(/^Dígito \d de 6$/)).toHaveLength(6);
      expect(within(contaSection()).queryByLabelText('Nova senha')).toBeNull();
      await userEvent.click(within(contaSection()).getByRole('button', { name: 'Cancelar' }));
    }
  });

  it('a password cannot be removed', () => {
    for (const hasPassword of [true, false]) {
      const view = renderSettings(makeAuthContext({ user: account(hasPassword) }));
      const buttons = within(contaSection()).getAllByRole('button');
      expect(buttons.filter((button) => /remover|apagar|tirar/i.test(button.textContent ?? ''))).toHaveLength(0);
      view.unmount();
    }
  });
});

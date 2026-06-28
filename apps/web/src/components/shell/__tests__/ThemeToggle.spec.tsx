/**
 * ThemeToggle tests — U12 (Onda 3 residual)
 *
 * Covers:
 *  - Happy path: click calls auth.setSettings + fires PATCH; no toast on success
 *  - Error path: PATCH 500 → toast with divergence copy + console.error called
 *  - Error path: PATCH 429 → same toast path (UI doesn't differentiate today)
 *  - DOM + localStorage writes are idempotent with the AuthProvider theme path
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthContext, IAuthContext } from '../../../auth/AuthContext';
import { AuthFetchError } from '../../../auth/AuthProvider';

// --- Mocks ---

// ToggleGroup — expose onValueChange directly via captured closure
let capturedOnValueChange: ((v: string) => void) | undefined;
vi.mock('@radix-ui/react-toggle-group', () => ({
  Root: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
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
  Item: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button
      data-testid={`theme-toggle-${value}`}
      onClick={() => capturedOnValueChange?.(value)}
    >
      {children}
    </button>
  ),
}));

const toastShow = vi.fn();
vi.mock('../../ui/Toast/useToast', () => ({
  useToast: () => ({ show: toastShow }),
}));

const patchMock = vi.fn();
vi.mock('../../../api/user-settings', () => ({
  patchUserSettings: (...args: unknown[]) => patchMock(...args),
  fetchUserSettings: vi.fn(),
}));

import { ThemeToggle } from '../ThemeToggle';

// --- Harness ---

function makeAuthContext(overrides: Partial<IAuthContext> = {}): IAuthContext {
  return {
    user: { id: 'u1', email: 'hero@rathe.gg', role: 'user' },
    token: 'jwt-token',
    isLoading: false,
    setSettings: vi.fn(),
    signUp: async () => ({}),
    signIn: async () => {},
    signOut: () => {},
    verifyEmail: async () => {},
    forgotPassword: async () => {},
    resetPassword: async () => {},
    deleteAccount: async () => {},
    ...overrides,
  };
}

function renderToggle(ctx: IAuthContext = makeAuthContext()) {
  return render(
    <AuthContext.Provider value={ctx}>
      <ThemeToggle />
    </AuthContext.Provider>,
  );
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  patchMock.mockReset();
  toastShow.mockReset();
  capturedOnValueChange = undefined;
  document.documentElement.dataset.theme = 'dark';
  localStorage.clear();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Tests ---

describe('ThemeToggle — happy path', () => {
  it('updates dataset.theme and localStorage on click', () => {
    patchMock.mockResolvedValue({ theme: 'light' });
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('rathe-arsenal:theme')).toBe('light');
  });

  it('calls auth.setSettings with the new theme', () => {
    patchMock.mockResolvedValue({ theme: 'light' });
    const setSettings = vi.fn();
    renderToggle(makeAuthContext({ setSettings }));
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    expect(setSettings).toHaveBeenCalledWith({ theme: 'light' });
  });

  it('fires PATCH with the new theme and current token', () => {
    patchMock.mockResolvedValue({ theme: 'light' });
    renderToggle(makeAuthContext({ token: 'jwt-abc' }));
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    expect(patchMock).toHaveBeenCalledWith('light', 'jwt-abc');
  });

  it('does NOT show a toast on PATCH success', async () => {
    patchMock.mockResolvedValue({ theme: 'light' });
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    // Allow microtasks to settle for the .catch handler absence
    await new Promise((r) => setTimeout(r, 0));
    expect(toastShow).not.toHaveBeenCalled();
  });
});

describe('ThemeToggle — error path (divergence copy)', () => {
  it('shows toast with exact divergence copy when PATCH returns 500', async () => {
    patchMock.mockRejectedValue(new AuthFetchError('Server error', 500));
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    await waitFor(() => expect(toastShow).toHaveBeenCalled());
    expect(toastShow).toHaveBeenCalledWith({
      kind: 'error',
      message: "Saved locally — didn't reach the server. Will retry on next change.",
    });
  });

  it('shows the same toast when PATCH is rate-limited (429)', async () => {
    patchMock.mockRejectedValue(new AuthFetchError('Too many requests', 429));
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-dark'));
    await waitFor(() => expect(toastShow).toHaveBeenCalled());
    expect(toastShow).toHaveBeenCalledTimes(1);
  });

  it('still writes localStorage on failure (flash prevention > cross-device sync)', async () => {
    patchMock.mockRejectedValue(new AuthFetchError('nope', 500));
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    // localStorage was already written synchronously before the PATCH; the plan
    // explicitly preserves it on failure so the next reload stays on the user's
    // most recent intended theme.
    expect(localStorage.getItem('rathe-arsenal:theme')).toBe('light');
    await waitFor(() => expect(toastShow).toHaveBeenCalled());
    expect(localStorage.getItem('rathe-arsenal:theme')).toBe('light');
  });

  it('logs the underlying error via console.error for dev diagnosis', async () => {
    const err = new AuthFetchError('boom', 500);
    patchMock.mockRejectedValue(err);
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(consoleErrorSpy).toHaveBeenCalledWith('[theme-toggle] server PATCH failed', err);
  });
});

describe('ThemeToggle — rapid interactions', () => {
  it('dispatches two PATCHes when user double-clicks across values', () => {
    patchMock.mockResolvedValue({ theme: 'light' });
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    fireEvent.click(screen.getByTestId('theme-toggle-dark'));
    expect(patchMock).toHaveBeenCalledTimes(2);
    expect(patchMock).toHaveBeenNthCalledWith(1, 'light', 'jwt-token');
    expect(patchMock).toHaveBeenNthCalledWith(2, 'dark', 'jwt-token');
  });

  it('final dataset.theme reflects the last click even if earlier PATCHes are in-flight', () => {
    let resolver: (v: { theme: string }) => void = () => {};
    patchMock.mockImplementationOnce(() => new Promise((r) => (resolver = r)));
    patchMock.mockResolvedValueOnce({ theme: 'dark' });
    renderToggle();
    fireEvent.click(screen.getByTestId('theme-toggle-light'));
    fireEvent.click(screen.getByTestId('theme-toggle-dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    resolver({ theme: 'light' }); // resolve the stale first PATCH — no effect
  });
});

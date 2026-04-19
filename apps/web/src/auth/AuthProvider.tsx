import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, IAuthSettings, IAuthUser } from './AuthContext';

const STORAGE_KEY = 'rathe-arsenal:jwt';
const THEME_STORAGE_KEY = 'rathe-arsenal:theme';

/**
 * Error thrown by {@link apiFetch} on non-2xx responses. Carries HTTP status so
 * the UI can branch on 429 (rate-limited) vs other failures, and the parsed
 * `Retry-After` header (seconds) when present. See Unit 1 / A5.
 */
export class AuthFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'AuthFetchError';
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.ceil(asSeconds);
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return null;
}

async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = body.error ?? body.message ?? res.statusText;
    const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
    throw new AuthFetchError(message, res.status, retryAfter);
  }
  return (await res.json()) as T;
}

/**
 * U12 — applies a theme value to the DOM and localStorage in sync.
 * The inline theme-init script in index.html already read localStorage before
 * hydration; this keeps server-sourced values in lockstep on subsequent writes.
 */
function applyTheme(theme: 'dark' | 'light'): void {
  // Runtime whitelist guard — closes the TS→runtime gap at the DOM write boundary,
  // mirroring the pre-hydration IIFE in index.html. If a future code path slips a
  // non-whitelisted value through TypeScript (deserialisation, `as` cast), it cannot
  // reach `dataset.theme`.
  if (theme !== 'dark' && theme !== 'light') return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing etc — fail silently; dataset.theme is still applied.
  }
}

interface IAuthMeResponse {
  id: string;
  email: string;
  settings: IAuthSettings;
}

interface IAuthSignResponse {
  jwt: string;
  user: IAuthUser;
  settings: IAuthSettings;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IAuthUser | null>(null);
  const [settings, setSettingsState] = useState<IAuthSettings | undefined>(undefined);
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(!!token);

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    apiFetch<IAuthMeResponse>('/auth/me', {}, token)
      .then((res) => {
        setUser({ id: res.id, email: res.email });
        // Defensive: old server versions without the field shouldn't partial-apply;
        // only touch theme state when the server actually returned a valid shape.
        if (res.settings?.theme) {
          setSettingsState(res.settings);
          applyTheme(res.settings.theme);
        }
      })
      .catch(() => { localStorage.removeItem(STORAGE_KEY); setToken(null); setUser(null); setSettingsState(undefined); })
      .finally(() => setIsLoading(false));
  }, [token]);

  const persist = useCallback((jwt: string, u: IAuthUser, s: IAuthSettings) => {
    localStorage.setItem(STORAGE_KEY, jwt);
    setToken(jwt);
    setUser(u);
    setSettingsState(s);
    applyTheme(s.theme);
  }, []);

  const setSettings = useCallback((next: IAuthSettings) => {
    setSettingsState(next);
    applyTheme(next.theme);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ message: string; _devVerificationLink?: string }>(
      '/auth/sign-up', { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    return { _devVerificationLink: res._devVerificationLink };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<IAuthSignResponse>(
      '/auth/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    persist(res.jwt, res.user, res.settings);
  }, [persist]);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    // Also clear the theme hint — without this, a shared device can leak the
    // previous user's theme to the next sign-in via the pre-hydration script.
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* private mode */ }
    setToken(null);
    setUser(null);
    setSettingsState(undefined);
    // Reset DOM to the product default so the anonymous session doesn't
    // carry the ex-user's theme between signOut and the next auth bootstrap.
    applyTheme('dark');
  }, []);

  const verifyEmail = useCallback(async (tkn: string) => {
    const res = await apiFetch<IAuthSignResponse>(
      '/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: tkn }) },
    );
    persist(res.jwt, res.user, res.settings);
  }, [persist]);

  const forgotPassword = useCallback(async (email: string) => {
    await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }, []);

  const resetPassword = useCallback(async (tkn: string, newPassword: string) => {
    const res = await apiFetch<IAuthSignResponse>(
      '/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: tkn, newPassword }) },
    );
    persist(res.jwt, res.user, res.settings);
  }, [persist]);

  const deleteAccount = useCallback(async (password: string) => {
    await apiFetch<{ ok: true }>(
      '/auth/me',
      { method: 'DELETE', body: JSON.stringify({ password }) },
      token,
    );
    localStorage.removeItem(STORAGE_KEY);
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch { /* private mode */ }
    setToken(null);
    setUser(null);
    setSettingsState(undefined);
    applyTheme('dark');
  }, [token]);

  const value = useMemo(() => ({
    user, token, isLoading, settings, setSettings,
    signUp, signIn, signOut, verifyEmail, forgotPassword, resetPassword, deleteAccount,
  }), [user, token, isLoading, settings, setSettings, signUp, signIn, signOut, verifyEmail, forgotPassword, resetPassword, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext, IAuthSettings, IAuthUser, TUserRole } from './AuthContext';
import { THEME_STORAGE_KEY } from '../styles/theme-init';
import { authFetch as apiFetch, AuthFetchError } from '../lib/auth-fetch';

// Re-export so existing consumers that imported AuthFetchError from this module
// continue to compile without an import rewrite.
export { AuthFetchError };

const STORAGE_KEY = 'rathe-arsenal:jwt';

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
  role: TUserRole;
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

  // persist() sets the token and seeds user+settings atomically from the auth
  // response payload — the bootstrap effect below would otherwise re-fetch
  // /auth/me and race against any optimistic write made between sign-in and the
  // effect running. A ref-flag marks the "just-persisted" state so the effect
  // skips exactly one run per session-start. See ce-review residual P1.
  const justPersistedRef = useRef(false);

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    if (justPersistedRef.current) {
      justPersistedRef.current = false;
      setIsLoading(false);
      return;
    }
    apiFetch<IAuthMeResponse>('/auth/me', {}, token)
      .then((res) => {
        // Default to 'user' if an older server response omits role (fail-safe:
        // never grant admin UI on a missing field).
        setUser({ id: res.id, email: res.email, role: res.role ?? 'user' });
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
    justPersistedRef.current = true;
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
    // Clear all composition draft keys (ra-deck-draft-*) so a new user on a
    // shared device cannot see previous user's unsaved deck edits.
    // Per-user UX prefs (ra-deck-sidebar-expanded, ra-shelf-retired-expanded) stay.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ra-deck-draft-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* private mode */ }
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
    // Clear all composition draft keys (ra-deck-draft-*) so a deleted account's
    // deck draft data does not remain on the device.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ra-deck-draft-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* private mode */ }
    setToken(null);
    setUser(null);
    setSettingsState(undefined);
    applyTheme('dark');
  }, [token]);

  const value = useMemo(() => ({
    user, token, isLoading,
    // exactOptionalPropertyTypes: only attach the settings key when defined;
    // assigning `undefined` to an optional field is a type error.
    ...(settings !== undefined ? { settings } : {}),
    setSettings,
    signUp, signIn, signOut, verifyEmail, forgotPassword, resetPassword, deleteAccount,
  }), [user, token, isLoading, settings, setSettings, signUp, signIn, signOut, verifyEmail, forgotPassword, resetPassword, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext, IAuthSettings, IAuthUser, ICodeSignIn, ISignUpInput, TUserRole } from './AuthContext';
import { THEME_STORAGE_KEY } from '../styles/theme-init';
import { authFetch as apiFetch, AuthFetchError } from '../lib/auth-fetch';
import { onUnauthorized } from '../lib/session-events';
import { changeAccountEmail, confirmEmail, type IEmailConfirmation } from '../lib/account-api';

// Re-export so existing consumers that imported AuthFetchError from this module
// continue to compile without an import rewrite.
export { AuthFetchError };

/** Where the JWT of the old sessions lived; removed on load, since the session is a cookie now (door 17). */
const LEGACY_TOKEN_KEY = 'rathe-arsenal:jwt';

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
  chatAccess?: boolean;
  emailConfirmed?: boolean;
  hasPassword?: boolean;
  displayName?: string | null;
  whatsappNumber?: string | null;
  shareClosingLine?: string | null;
  settings: IAuthSettings;
}

interface IAuthSignResponse {
  user: Omit<IAuthUser, 'chatAccess'> & { chatAccess?: boolean };
  settings: IAuthSettings;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IAuthUser | null>(null);
  const [settings, setSettingsState] = useState<IAuthSettings | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // The latest signed-in state for the 401 listener and the bootstrap, which must not re-subscribe on every render.
  const signedInRef = useRef(false);

  // The session lives in an httpOnly cookie the page cannot see, so the only way to know whether this
  // device is signed in is to ask the server; a 401 means signed out.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch { /* private mode */ }
    let cancelled = false;
    apiFetch<IAuthMeResponse>('/auth/me')
      .then((res) => {
        // A sign-in made while this request was in flight already holds the newer answer.
        if (cancelled || signedInRef.current) return;
        signedInRef.current = true;
        // Default to 'user' if an older server response omits role (fail-safe:
        // never grant admin UI on a missing field).
        setUser({ id: res.id, email: res.email, role: res.role ?? 'user', chatAccess: res.chatAccess === true, emailConfirmed: res.emailConfirmed === true, hasPassword: res.hasPassword === true, displayName: res.displayName ?? null, whatsappNumber: res.whatsappNumber ?? null, shareClosingLine: res.shareClosingLine ?? null });
        setRestored(true);
        // Defensive: old server versions without the field shouldn't partial-apply;
        // only touch theme state when the server actually returned a valid shape.
        if (res.settings?.theme) {
          setSettingsState(res.settings);
          applyTheme(res.settings.theme);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // The API answered 401 to a request that was not a sign-in attempt: the session ended on the server.
  // The page stays where it is, so its draft survives, and the sign-in sheet opens over it.
  useEffect(() => onUnauthorized(() => {
    if (signedInRef.current) setSessionEnded(true);
  }), []);

  const persist = useCallback((u: IAuthSignResponse['user'], s: IAuthSettings) => {
    signedInRef.current = true;
    setRestored(false);
    setSessionEnded(false);
    setUser({ ...u, chatAccess: u.chatAccess === true });
    setSettingsState(s);
    applyTheme(s.theme);
  }, []);

  const setSettings = useCallback((next: IAuthSettings) => {
    setSettingsState(next);
    applyTheme(next.theme);
  }, []);

  const signUp = useCallback(async (input: ISignUpInput) => {
    const res = await apiFetch<IAuthSignResponse>(
      '/auth/sign-up',
      { method: 'POST', body: JSON.stringify(input) },
    );
    persist(res.user, res.settings);
  }, [persist]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<IAuthSignResponse>(
      '/auth/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    persist(res.user, res.settings);
  }, [persist]);

  /** Clears everything this device holds about the account; shared by "Sair" and a deleted account. */
  const clearLocalAccount = useCallback(() => {
    signedInRef.current = false;
    setRestored(false);
    setSessionEnded(false);
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
    setUser(null);
    setSettingsState(undefined);
    // Reset DOM to the product default so the anonymous session doesn't
    // carry the ex-user's theme between signOut and the next auth bootstrap.
    applyTheme('dark');
  }, []);

  const signOut = useCallback(() => {
    // Signed out first, so the 401 an already-ended session answers does not open the sheet.
    signedInRef.current = false;
    apiFetch<void>('/auth/sign-out', { method: 'POST' })
      // The server may be unreachable or the session already ended; this device is signed out either way.
      .catch(() => undefined)
      .finally(clearLocalAccount);
  }, [clearLocalAccount]);

  const setDisplayName = useCallback((displayName: string) => {
    setUser((prev) => (prev === null ? prev : { ...prev, displayName }));
  }, []);

  const setWhatsappNumber = useCallback((whatsappNumber: string | null) => {
    setUser((prev) => (prev === null ? prev : { ...prev, whatsappNumber }));
  }, []);

  const setShareClosingLine = useCallback((text: string) => {
    setUser((prev) => (prev === null ? prev : { ...prev, shareClosingLine: text }));
  }, []);

  const setHasPassword = useCallback((hasPassword: boolean) => {
    setUser((prev) => (prev === null ? prev : { ...prev, hasPassword }));
  }, []);

  const verifyEmail = useCallback(async (tkn: string): Promise<IEmailConfirmation> => {
    const confirmation = await confirmEmail(tkn);
    setUser((prev) => (prev !== null && prev.email === confirmation.email ? { ...prev, emailConfirmed: true } : prev));
    return confirmation;
  }, []);

  const changeEmail = useCallback(async (email: string) => {
    const res = await changeAccountEmail(email);
    setUser((prev) => (prev === null ? prev : { ...prev, email: res.user.email }));
  }, []);

  const verifyCode = useCallback(async (email: string, code: string): Promise<ICodeSignIn> => {
    const res = await apiFetch<IAuthSignResponse & ICodeSignIn>(
      '/auth/codes/verify', { method: 'POST', body: JSON.stringify({ email, code }) },
    );
    persist(res.user, res.settings);
    return { returnPath: res.returnPath };
  }, [persist]);

  const redeemCode = useCallback(async (token: string): Promise<ICodeSignIn> => {
    const res = await apiFetch<IAuthSignResponse & ICodeSignIn>(
      '/auth/codes/redeem', { method: 'POST', body: JSON.stringify({ token }) },
    );
    persist(res.user, res.settings);
    return { returnPath: res.returnPath };
  }, [persist]);

  const deleteAccount = useCallback(async (password: string) => {
    await apiFetch<{ ok: true }>('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) });
    clearLocalAccount();
  }, [clearLocalAccount]);

  const value = useMemo(() => ({
    user, isLoading,
    ...(sessionEnded ? { sessionEnded: true } : {}),
    ...(restored ? { restoredSession: true } : {}),
    // exactOptionalPropertyTypes: only attach the settings key when defined;
    // assigning `undefined` to an optional field is a type error.
    ...(settings !== undefined ? { settings } : {}),
    setSettings,
    signUp, signIn, signOut, verifyEmail, changeEmail, verifyCode, redeemCode, deleteAccount, setDisplayName, setWhatsappNumber, setShareClosingLine, setHasPassword,
  }), [user, isLoading, settings, restored, sessionEnded, setSettings, setDisplayName, setWhatsappNumber, setShareClosingLine, setHasPassword, signUp, signIn, signOut, verifyEmail, changeEmail, verifyCode, redeemCode, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

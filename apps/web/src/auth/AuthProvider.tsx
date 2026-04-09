import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext, IAuthUser } from './AuthContext';

const STORAGE_KEY = 'rathe-arsenal:jwt';

async function apiFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IAuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(!!token);

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    apiFetch<{ id: string; email: string }>('/auth/me', {}, token)
      .then((u) => { setUser(u); })
      .catch(() => { localStorage.removeItem(STORAGE_KEY); setToken(null); setUser(null); })
      .finally(() => setIsLoading(false));
  }, [token]);

  const persist = useCallback((jwt: string, u: IAuthUser) => {
    localStorage.setItem(STORAGE_KEY, jwt);
    setToken(jwt);
    setUser(u);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ userId: string; email: string; _devVerificationLink?: string }>(
      '/auth/sign-up', { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    return { _devVerificationLink: res._devVerificationLink };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ jwt: string; user: IAuthUser }>(
      '/auth/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    persist(res.jwt, res.user);
  }, [persist]);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const verifyEmail = useCallback(async (tkn: string) => {
    const res = await apiFetch<{ jwt: string; user: IAuthUser }>(
      '/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: tkn }) },
    );
    persist(res.jwt, res.user);
  }, [persist]);

  const forgotPassword = useCallback(async (email: string) => {
    await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }, []);

  const resetPassword = useCallback(async (tkn: string, newPassword: string) => {
    const res = await apiFetch<{ jwt: string; user: IAuthUser }>(
      '/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: tkn, newPassword }) },
    );
    persist(res.jwt, res.user);
  }, [persist]);

  const value = useMemo(() => ({
    user, token, isLoading, signUp, signIn, signOut, verifyEmail, forgotPassword, resetPassword,
  }), [user, token, isLoading, signUp, signIn, signOut, verifyEmail, forgotPassword, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { AuthFetchError } from '../auth/AuthProvider';

export type TTheme = 'dark' | 'light';

export interface IUserSettings {
  theme: TTheme;
}

async function apiFetch<T>(path: string, init: RequestInit, token: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = body.error ?? body.message ?? res.statusText;
    throw new AuthFetchError(message, res.status);
  }
  return (await res.json()) as T;
}

export function fetchUserSettings(token: string | null): Promise<IUserSettings> {
  return apiFetch<IUserSettings>('/users/me/settings', { method: 'GET' }, token);
}

export function patchUserSettings(theme: TTheme, token: string | null): Promise<IUserSettings> {
  return apiFetch<IUserSettings>(
    '/users/me/settings',
    { method: 'PATCH', body: JSON.stringify({ theme }) },
    token,
  );
}

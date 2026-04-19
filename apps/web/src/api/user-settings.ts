import { authFetch } from '../lib/auth-fetch';
import type { TTheme } from '../styles/theme-init';

export type { TTheme };

export interface IUserSettings {
  theme: TTheme;
}

/**
 * Reserved for a future consumer — the shell + ThemeToggle get settings via
 * the /auth/me bootstrap and sign-in response today, so the GET endpoint has
 * no direct caller. Kept as the canonical client wrapper so Plan B surfaces
 * (settings page re-fetch on focus, etc.) import from here rather than
 * re-implementing the fetch shape.
 */
export function fetchUserSettings(token: string | null): Promise<IUserSettings> {
  return authFetch<IUserSettings>('/users/me/settings', { method: 'GET' }, token);
}

export function patchUserSettings(theme: TTheme, token: string | null): Promise<IUserSettings> {
  return authFetch<IUserSettings>(
    '/users/me/settings',
    { method: 'PATCH', body: JSON.stringify({ theme }) },
    token,
  );
}

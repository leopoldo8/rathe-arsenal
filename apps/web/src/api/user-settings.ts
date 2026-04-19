import { authFetch } from '../lib/auth-fetch';
import type { TTheme } from '../styles/theme-init';

export type { TTheme };

export interface IUserSettings {
  theme: TTheme;
}

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

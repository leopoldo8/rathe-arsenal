export const DEFAULT_APP_BASE_URL = 'http://localhost:5173';

export function buildDeckShareUrl(baseUrl: string | undefined, token: string): string {
  const base = (baseUrl ?? DEFAULT_APP_BASE_URL).replace(/\/+$/, '');
  return `${base}/d/${token}`;
}

export function buildListShareUrl(baseUrl: string | undefined, token: string): string {
  const base = (baseUrl ?? DEFAULT_APP_BASE_URL).replace(/\/+$/, '');
  return `${base}/l/${token}`;
}

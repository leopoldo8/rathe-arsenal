/**
 * Shared auth-aware fetch primitive.
 *
 * Extracted from AuthProvider to avoid divergent re-implementations across
 * `api/user-settings.ts` and other modules. Every consumer gets identical
 * Authorization injection, Content-Type defaulting, error envelope, and
 * Retry-After parsing so a 429 response carries `retryAfterSeconds` end-to-end.
 */

import i18n from '../i18n';

export class AuthFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null,
    /** Stable machine code from the API error envelope (e.g. EAuthErrorCode), for client-side localization. Null when the server omits it. */
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'AuthFetchError';
  }
}

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.ceil(asSeconds);
  // HTTP-date format fallback
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return null;
}

export async function authFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', i18n.language);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = body.error ?? body.message ?? res.statusText;
    const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
    const code = typeof body.code === 'string' ? body.code : null;
    throw new AuthFetchError(message, res.status, retryAfter, code);
  }
  return (await res.json()) as T;
}

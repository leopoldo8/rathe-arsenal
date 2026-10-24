import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'ra_session';

/** 400 days, the longest Chrome keeps a cookie (door 17). */
const SESSION_MAX_AGE_SECONDS = 34_560_000;

/**
 * Sets the `ra_session` cookie. Interim (batch 2): the value is today's JWT; the session table and
 * the opaque token of door 17 replace it in S32.
 */
export function setSessionCookie(res: Response, value: string, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api',
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    secure: isProduction,
  });
}

/** Reads one cookie from a raw `Cookie` header without a parser dependency (S32 adds `cookie-parser`). */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

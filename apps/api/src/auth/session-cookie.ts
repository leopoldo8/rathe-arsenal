import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'ra_session';

/** 400 days, the longest Chrome keeps a cookie (door 17). */
export const SESSION_MAX_AGE_SECONDS = 34_560_000;

export function sessionCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/api',
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    secure: isProduction,
  };
}

export function setSessionCookie(res: Response, token: string, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(isProduction));
}

/** Ends the cookie in the browser: same attributes as when it was set, with `Max-Age=0`. */
export function clearSessionCookie(res: Response, isProduction: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(isProduction), maxAge: 0 });
}

/** The token `cookie-parser` found, or null: it parses nothing when `configureHttpApp` was not applied. */
export function readSessionToken(req: Request): string | null {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

import { createHmac } from 'crypto';
import type { Response } from 'supertest';

const COOKIE_NAME = 'ra_session';

/** Every `Set-Cookie` header of a response, as raw strings. */
export function setCookiesOf(response: Response): string[] {
  return (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

/** The full `ra_session=...; attributes` header a response set, or null when it set none. */
export function sessionSetCookieOf(response: Response): string | null {
  return setCookiesOf(response).find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`)) ?? null;
}

/** The `ra_session` pair of a response, as a `Cookie` request header value. */
export function sessionCookieOf(response: Response): string | null {
  const header = sessionSetCookieOf(response);
  return header ? (header.split(';')[0] ?? null) : null;
}

/** The session token a sign-in response put in its cookie; throws when the response set none. */
export function sessionTokenOf(response: Response): string {
  const pair = sessionCookieOf(response);
  if (!pair) throw new Error(`no ${COOKIE_NAME} cookie in the response (status ${response.status})`);
  return pair.slice(COOKIE_NAME.length + 1);
}

/** The `Cookie` request header value for a session token. */
export function sessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}`;
}

/** A JWT of the kind sign-in handed out before door 17, valid for an hour and signed with the app's secret. */
export function legacyJwtFor(userId: string): string {
  const encode = (part: object): string => Buffer.from(JSON.stringify(part)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, iat: now, exp: now + 3600 })}`;
  const signature = createHmac('sha256', process.env['JWT_SECRET'] as string).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

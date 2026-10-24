import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../session-cookie';

describe('session cookie options (door 17)', () => {
  it('the cookie is Secure only in production', () => {
    const production = sessionCookieOptions(true);
    const development = sessionCookieOptions(false);
    const testing = sessionCookieOptions(process.env['NODE_ENV'] === 'test');

    expect(production.secure).toBe(true);
    expect(development.secure).toBe(false);
    expect(testing.secure).toBe(false);
    for (const options of [production, development, testing]) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/api', maxAge: 34_560_000 * 1000 });
    }
    expect(SESSION_COOKIE_NAME).toBe('ra_session');
  });
});

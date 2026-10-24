/**
 * Door 17 over HTTP against the local Postgres: the `ra_session` cookie and the `user_session`
 * table that replace the Bearer JWT, sign-out, revocation and the origin check on writes.
 * Needs DATABASE_URL (see `accounts-e2e.fixture.ts`).
 */
import { Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import request from 'supertest';
import { bootAccountsApp, IAccountsApp, PASSWORD } from './accounts-e2e.fixture';
import { legacyJwtFor, sessionCookieHeader, sessionSetCookieOf, sessionTokenOf, setCookiesOf } from './session-test-helpers';

const NEW_PASSWORD = 'a-new-session-password-123';
const SESSION_COOKIE_SHAPE = /^ra_session=[A-Za-z0-9_-]{43}; Max-Age=34560000; Path=\/api; HttpOnly; SameSite=Lax$/;

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const withoutExpires = (setCookie: string): string => setCookie.replace(/; Expires=[^;]+/, '');

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)]);
  }
  return [];
}

describe('Sessions (E2E, S32)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp();
  });

  afterAll(async () => {
    await ctx?.close();
    jest.clearAllMocks();
  });

  const server = (): ReturnType<IAccountsApp['app']['getHttpServer']> => ctx.app.getHttpServer();

  async function signUp(label: string, password: string | undefined = PASSWORD): Promise<{ email: string; response: request.Response }> {
    const email = ctx.emailFor(label);
    const response = await request(server()).post('/api/auth/sign-up').send({ email, ...(password ? { password } : {}) }).expect(201);
    return { email, response };
  }

  /** A confirmed address keeps its password when a code signs in, and so keeps its other sessions. */
  async function confirm(email: string): Promise<void> {
    await ctx.dataSource.query(`UPDATE "user" SET "emailVerifiedAt" = now() WHERE "email" = $1`, [email]);
  }

  async function signIn(email: string, password: string = PASSWORD): Promise<string> {
    const response = await request(server()).post('/api/auth/sign-in').send({ email, password }).expect(200);
    return sessionTokenOf(response);
  }

  async function codeFor(email: string): Promise<{ code: string; button: string }> {
    await request(server()).post('/api/auth/codes').send({ email }).expect(202);
    const sent = [...ctx.sentCodes].reverse().find((entry) => entry.to === email);
    if (!sent) throw new Error('no code e-mail was recorded');
    return { code: sent.code, button: new URL(sent.link).searchParams.get('token') ?? '' };
  }

  const meWith = (token: string): request.Test => request(server()).get('/api/auth/me').set('Cookie', sessionCookieHeader(token));

  it('each way in sets the session cookie and stores only its hash', async () => {
    const { email, response: signedUp } = await signUp('cookie-ways');
    await confirm(email);
    const signedIn = await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    const verifyCode = await codeFor(email);
    const verified = await request(server()).post('/api/auth/codes/verify').send({ email, code: verifyCode.code }).expect(200);
    const redeemCode = await codeFor(email);
    const redeemed = await request(server()).post('/api/auth/codes/redeem').send({ token: redeemCode.button }).expect(200);

    const tokens = new Set<string>();
    for (const response of [signedUp, signedIn, verified, redeemed]) {
      expect(setCookiesOf(response)).toHaveLength(1);
      expect(withoutExpires(sessionSetCookieOf(response) as string)).toMatch(SESSION_COOKIE_SHAPE);
      expect(sessionSetCookieOf(response)).not.toMatch(/Secure/i);
      const token = sessionTokenOf(response);
      tokens.add(token);
      const [row] = await ctx.dataSource.query(`SELECT "revokedAt" FROM "user_session" WHERE "tokenHash" = $1`, [sha256(token)]);
      expect(row).toEqual({ revokedAt: null });
      const [leaked] = await ctx.dataSource.query(`SELECT count(*)::int AS n FROM "user_session" WHERE "tokenHash" = $1`, [token]);
      expect(leaked.n).toBe(0);
    }
    expect(tokens.size).toBe(4);
  });

  it('a session has no fixed expiry and is renewed once a day', async () => {
    const { email } = await signUp('renewal');
    const token = await signIn(email);
    const hash = sha256(token);
    const setSeen = (createdAgo: string, seenAgo: string): Promise<unknown> =>
      ctx.dataSource.query(
        `UPDATE "user_session" SET "createdAt" = now() - $2::interval, "lastSeenAt" = now() - $3::interval WHERE "tokenHash" = $1`,
        [hash, createdAgo, seenAgo],
      );

    await setSeen('30 days', '23 hours');
    const recent = await meWith(token).expect(200);
    expect(sessionSetCookieOf(recent)).toBeNull();

    await setSeen('30 days', '25 hours');
    const stale = await meWith(token).expect(200);
    const renewed = withoutExpires(sessionSetCookieOf(stale) as string);
    expect(renewed).toBe(`ra_session=${token}; Max-Age=34560000; Path=/api; HttpOnly; SameSite=Lax`);
    const [row] = await ctx.dataSource.query(`SELECT extract(epoch FROM (now() - "lastSeenAt")) AS ago FROM "user_session" WHERE "tokenHash" = $1`, [hash]);
    expect(Number(row.ago)).toBeLessThan(30);

    const again = await meWith(token).expect(200);
    expect(sessionSetCookieOf(again)).toBeNull();
  });

  it('no response body carries the session token', async () => {
    const { email, response: signedUp } = await signUp('no-token-in-body');
    await confirm(email);
    const signedIn = await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    const verifyCode = await codeFor(email);
    const verified = await request(server()).post('/api/auth/codes/verify').send({ email, code: verifyCode.code }).expect(200);
    const redeemCode = await codeFor(email);
    const redeemed = await request(server()).post('/api/auth/codes/redeem').send({ token: redeemCode.button }).expect(200);
    const me = await meWith(sessionTokenOf(signedIn)).expect(200);

    for (const response of [signedUp, signedIn, verified, redeemed, me]) {
      const token = sessionTokenOf(response === me ? signedIn : response);
      expect(JSON.stringify(response.body)).not.toContain(token);
      expect(keysOf(response.body).filter((key) => /^(jwt|token|session)$/i.test(key))).toEqual([]);
    }
  });

  it('an old JWT is refused', async () => {
    const { response } = await signUp('old-jwt');
    const jwt = legacyJwtFor(response.body.user.id as string);

    const refused = await request(server()).get('/api/auth/me').set('Authorization', `Bearer ${jwt}`);

    expect(refused.status).toBe(401);
  });

  it('sign-out ends the session on the server and clears the cookie', async () => {
    const { email } = await signUp('sign-out');
    const token = await signIn(email);

    const out = await request(server()).post('/api/auth/sign-out').set('Cookie', sessionCookieHeader(token)).expect(204);

    const cleared = withoutExpires(sessionSetCookieOf(out) as string);
    expect(cleared).toMatch(/^ra_session=;/);
    expect(cleared).toContain('Max-Age=0');
    expect(cleared).toContain('Path=/api');
    const [row] = await ctx.dataSource.query(`SELECT "revokedAt" FROM "user_session" WHERE "tokenHash" = $1`, [sha256(token)]);
    expect(row.revokedAt).not.toBeNull();
    await meWith(token).expect(401);
    await request(server()).post('/api/auth/sign-out').expect(401);
  });

  it('signing out one device keeps the other', async () => {
    const { email } = await signUp('two-devices');
    const phone = await signIn(email);
    const computer = await signIn(email);

    await request(server()).post('/api/auth/sign-out').set('Cookie', sessionCookieHeader(phone)).expect(204);

    await meWith(phone).expect(401);
    await meWith(computer).expect(200);
  });

  it('deleting the account ends every session and a new password ends the others', async () => {
    const leaving = await signUp('delete-all');
    const first = await signIn(leaving.email);
    const second = await signIn(leaving.email);
    const deleted = await request(server())
      .delete('/api/auth/me')
      .set('Cookie', sessionCookieHeader(first))
      .send({ password: PASSWORD })
      .expect(200);
    expect(deleted.body).toEqual({ ok: true });
    await meWith(first).expect(401);
    await meWith(second).expect(401);
    await meWith(sessionTokenOf(leaving.response)).expect(401);

    const changing = await signUp('new-password');
    const here = await signIn(changing.email);
    const elsewhere = await signIn(changing.email);
    await request(server()).put('/api/users/me/password').set('Cookie', sessionCookieHeader(here)).send({ password: NEW_PASSWORD }).expect(204);
    await meWith(elsewhere).expect(401);
    await meWith(sessionTokenOf(changing.response)).expect(401);
    await meWith(here).expect(200);
    await request(server()).post('/api/auth/sign-in').send({ email: changing.email, password: NEW_PASSWORD }).expect(200);
  });

  it('a code sign-in that drops an unproven password ends the sessions opened with it', async () => {
    const { email, response: attackerSignUp } = await signUp('hijack');
    const attackerSignedIn = await signIn(email);
    const { code } = await codeFor(email);

    const owner = await request(server()).post('/api/auth/codes/verify').send({ email, code }).expect(200);

    await meWith(sessionTokenOf(attackerSignUp)).expect(401);
    await meWith(attackerSignedIn).expect(401);
    await meWith(sessionTokenOf(owner)).expect(200);
    await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(401);
  });

  describe('the origin check', () => {
    const EVIL = 'https://evil.example';
    const OWN = 'http://localhost:5173';

    it('writes from another origin are refused and change nothing', async () => {
      const { email, response } = await signUp('origin');
      const token = sessionTokenOf(response);
      const cookie = sessionCookieHeader(token);
      const userRow = async (): Promise<{ displayName: string | null; passwordHash: string | null }> =>
        (await ctx.dataSource.query(`SELECT "displayName", "passwordHash" FROM "user" WHERE "email" = $1`, [email]))[0];
      const listCount = async (): Promise<number> =>
        (await ctx.dataSource.query(`SELECT count(*)::int AS n FROM "card_list" WHERE "userId" = (SELECT "id" FROM "user" WHERE "email" = $1)`, [email]))[0].n;
      const warn = jest.spyOn(Logger.prototype, 'warn');

      const keeper = await request(server()).post('/api/lists').set('Cookie', cookie).send({ kind: 'want', name: 'Keeper' }).expect(201);
      const before = { user: await userRow(), lists: await listCount() };

      const refused = [
        await request(server()).post('/api/lists').set('Cookie', cookie).set('Origin', EVIL).send({ kind: 'want', name: 'Planted' }),
        await request(server()).put('/api/users/me/password').set('Cookie', cookie).set('Origin', EVIL).send({ password: NEW_PASSWORD }),
        await request(server()).patch('/api/users/me/display-name').set('Cookie', cookie).set('Origin', EVIL).send({ displayName: 'Mallory' }),
        await request(server()).delete(`/api/lists/${keeper.body.id}`).set('Cookie', cookie).set('Origin', EVIL),
      ];

      for (const rejected of refused) {
        expect(rejected.status).toBe(403);
        expect(rejected.body.code).toBe('ORIGIN_REJECTED');
      }
      expect({ user: await userRow(), lists: await listCount() }).toEqual(before);
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ origin: EVIL }));
      warn.mockRestore();
      await request(server()).get('/api/auth/me').set('Cookie', cookie).set('Origin', EVIL).expect(200);

      const attempt = async (origin: string | null, cookieHeader: string | null): Promise<number[]> => {
        const call = (test: request.Test): request.Test => {
          const withOrigin = origin === null ? test : test.set('Origin', origin);
          return cookieHeader === null ? withOrigin : withOrigin.set('Cookie', cookieHeader);
        };
        const created = await call(request(server()).post('/api/lists')).send({ kind: 'want', name: 'Mine' });
        const statuses = [created.status];
        statuses.push((await call(request(server()).patch('/api/users/me/display-name')).send({ displayName: 'Bia' })).status);
        statuses.push((await call(request(server()).put('/api/users/me/password')).send({ password: NEW_PASSWORD })).status);
        statuses.push((await call(request(server()).delete(`/api/lists/${created.body.id ?? 0}`)).send()).status);
        return statuses;
      };

      expect(await attempt(OWN, cookie)).toEqual([201, 200, 204, 204]);
      expect(await attempt(null, cookie)).toEqual([201, 200, 204, 204]);
      expect(await attempt(null, null)).toEqual([401, 401, 401, 401]);
    });
  });
});

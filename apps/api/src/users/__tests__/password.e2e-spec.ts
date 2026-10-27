/**
 * S35 and S40 over HTTP against the local Postgres: creating or changing the password from Settings.
 * Needs DATABASE_URL (see `auth/__tests__/accounts-e2e.fixture.ts`).
 */
import request from 'supertest';
import { bootAccountsApp, IAccountsApp, PASSWORD } from '../../auth/__tests__/accounts-e2e.fixture';
import { sessionCookieHeader, sessionTokenOf } from '../../auth/__tests__/session-test-helpers';

const NEW_PASSWORD = 'a-brand-new-password-456';

describe('Password in Settings (E2E, S35)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp();
  });

  afterAll(async () => {
    await ctx?.close();
    jest.clearAllMocks();
  });

  const server = (): ReturnType<IAccountsApp['app']['getHttpServer']> => ctx.app.getHttpServer();
  const as = (token: string): [string, string] => ['Cookie', sessionCookieHeader(token)];

  async function signUp(label: string, password?: string): Promise<{ email: string; token: string }> {
    const email = ctx.emailFor(label);
    const response = await request(server()).post('/api/auth/sign-up').send({ email, ...(password ? { password } : {}) }).expect(201);
    return { email, token: sessionTokenOf(response) };
  }

  /** Asks the e-mailed code of the password change and returns the digits that reached the inbox. */
  async function askCode(token: string, email: string): Promise<string> {
    const before = ctx.sentPasswordCodes.length;
    await request(server()).post('/api/users/me/password-code').set(...as(token)).expect(202);
    expect(ctx.sentPasswordCodes.length).toBe(before + 1);
    const sent = ctx.sentPasswordCodes[before] as { to: string; code: string };
    expect(sent.to).toBe(email);
    return sent.code;
  }

  const wrongCodeFor = (code: string): string => (code === '000000' ? '000001' : '000000');

  it('setting a password answers 204, 400 and 401', async () => {
    const { email, token } = await signUp('set-password');
    const code = await askCode(token, email);

    const set = await request(server()).put('/api/users/me/password').set(...as(token)).send({ code, password: NEW_PASSWORD });
    expect(set.status).toBe(204);
    const signedIn = await request(server()).post('/api/auth/sign-in').send({ email, password: NEW_PASSWORD });
    expect(signedIn.status).toBe(200);

    const fresh = await askCode(token, email);
    const tooShort = await request(server()).put('/api/users/me/password').set(...as(token)).send({ code: fresh, password: '123456789' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.code).toBe('PASSWORD_TOO_SHORT');
    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({ code: fresh, password: '' })).status).toBe(400);
    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({ code: fresh })).status).toBe(400);
    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({ password: NEW_PASSWORD })).status).toBe(400);
    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({ code: wrongCodeFor(fresh), password: NEW_PASSWORD })).status).toBe(400);
    expect((await request(server()).put('/api/users/me/password').send({ code: fresh, password: NEW_PASSWORD })).status).toBe(401);
  });

  it('asking for a password code answers 202, 401 and 429 and sends it to the account\'s address', async () => {
    const { email, token } = await signUp('password-code');
    const other = await signUp('password-code-other');

    const asked = await request(server()).post('/api/users/me/password-code').set(...as(token));
    expect(asked.status).toBe(202);
    const expiresInMs = new Date(asked.body.expiresAt as string).getTime() - Date.now();
    expect(expiresInMs).toBeGreaterThan(14 * 60 * 1000);
    expect(expiresInMs).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(new Date(asked.body.resendAfter as string).getTime()).toBeGreaterThan(Date.now());
    expect(ctx.sentPasswordCodes.filter((sent) => sent.to === email)).toHaveLength(1);
    expect(ctx.sentPasswordCodes.filter((sent) => sent.to === other.email)).toHaveLength(0);
    expect(ctx.sentPasswordCodes[ctx.sentPasswordCodes.length - 1]?.code).toMatch(/^\d{6}$/);

    // The digits of a password change open no session on the sign-in route.
    const code = ctx.sentPasswordCodes[ctx.sentPasswordCodes.length - 1]?.code as string;
    const signIn = await request(server()).post('/api/auth/codes/verify').send({ email, code });
    expect(signIn.status).toBe(401);
    expect(signIn.headers['set-cookie']).toBeUndefined();

    expect((await request(server()).post('/api/users/me/password-code')).status).toBe(401);

    for (let asks = 2; asks <= 5; asks += 1) {
      await request(server()).post('/api/users/me/password-code').set(...as(token)).expect(202);
    }
    const limited = await request(server()).post('/api/users/me/password-code').set(...as(token));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('changing the password needs the e-mailed code and answers 204, 400, 401, 410 and 429', async () => {
    const { email, token } = await signUp('change-password', PASSWORD);
    const put = (body: object, cookie = true) => {
      const call = request(server()).put('/api/users/me/password');
      return (cookie ? call.set(...as(token)) : call).send(body);
    };

    // Right code and a 10-character password.
    const code = await askCode(token, email);
    const wrong = await put({ code: wrongCodeFor(code), password: NEW_PASSWORD });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('INVALID_CODE');
    expect((await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD })).status).toBe(200);

    expect((await put({ password: NEW_PASSWORD })).status).toBe(400);
    expect((await put({ code: '12345', password: NEW_PASSWORD })).status).toBe(400);
    expect((await put({ code: 'abcdef', password: NEW_PASSWORD })).status).toBe(400);
    expect((await put({ code, password: '123456789' })).status).toBe(400);
    expect((await put({ code, password: NEW_PASSWORD }, false)).status).toBe(401);

    // Another session of the account ends with the change; the one that called stays.
    const otherSession = sessionTokenOf(await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200));
    expect((await put({ code, password: NEW_PASSWORD })).status).toBe(204);
    expect((await request(server()).post('/api/auth/sign-in').send({ email, password: NEW_PASSWORD })).status).toBe(200);
    expect((await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD })).status).toBe(401);
    expect((await request(server()).get('/api/auth/me').set(...as(otherSession))).status).toBe(401);
    expect((await request(server()).get('/api/auth/me').set(...as(token))).status).toBe(200);

    // A code that was used answers 410.
    expect((await put({ code, password: 'another-password-789' })).status).toBe(410);

    // A code past its life answers 410.
    const late = await askCode(token, email);
    await ctx.dataSource.query(`UPDATE "sign_in_code" SET "expiresAt" = now() - interval '1 minute' WHERE "email" = $1 AND "consumedAt" IS NULL`, [email]);
    expect((await put({ code: late, password: 'another-password-789' })).status).toBe(410);

    // Five wrong tries answer 400, the sixth 429, and then even the right digits are refused.
    const guarded = await askCode(token, email);
    for (let tries = 1; tries <= 5; tries += 1) {
      expect((await put({ code: wrongCodeFor(guarded), password: 'another-password-789' })).status).toBe(400);
    }
    const sixth = await put({ code: wrongCodeFor(guarded), password: 'another-password-789' });
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);
    expect((await put({ code: guarded, password: 'another-password-789' })).status).toBe(429);
  });

  it('GET /api/auth/me says whether the account has a password', async () => {
    const withPassword = await signUp('has-password', PASSWORD);
    const codeOnly = await signUp('code-only');

    const first = await request(server()).get('/api/auth/me').set(...as(withPassword.token)).expect(200);
    const second = await request(server()).get('/api/auth/me').set(...as(codeOnly.token)).expect(200);
    expect(first.body.hasPassword).toBe(true);
    expect(second.body.hasPassword).toBe(false);

    const code = await askCode(codeOnly.token, codeOnly.email);
    await request(server()).put('/api/users/me/password').set(...as(codeOnly.token)).send({ code, password: NEW_PASSWORD }).expect(204);
    expect((await request(server()).get('/api/auth/me').set(...as(codeOnly.token))).body.hasPassword).toBe(true);
  });

  it('no route clears a password', async () => {
    const { email, token } = await signUp('keeps-password', PASSWORD);

    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({ password: null })).status).toBe(400);
    for (const method of ['delete', 'patch', 'post'] as const) {
      const response = await request(server())[method]('/api/users/me/password').set(...as(token)).send({ password: null });
      expect(response.status).toBe(404);
    }

    const [row] = (await ctx.dataSource.query(`SELECT "passwordHash" FROM "user" WHERE "email" = $1`, [email])) as [{ passwordHash: string | null }];
    expect(row.passwordHash).not.toBeNull();
    expect((await request(server()).post('/api/auth/sign-in').send({ email, password: PASSWORD })).status).toBe(200);
  });
});

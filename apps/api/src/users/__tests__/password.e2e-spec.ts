/**
 * S35 over HTTP against the local Postgres: creating or changing the password from Settings.
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

  it('setting a password answers 204, 400 and 401', async () => {
    const { email, token } = await signUp('set-password');

    const set = await request(server()).put('/api/users/me/password').set(...as(token)).send({ password: NEW_PASSWORD });
    expect(set.status).toBe(204);
    const signedIn = await request(server()).post('/api/auth/sign-in').send({ email, password: NEW_PASSWORD });
    expect(signedIn.status).toBe(200);

    const tooShort = await request(server()).put('/api/users/me/password').set(...as(token)).send({ password: '123456789' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.code).toBe('PASSWORD_TOO_SHORT');
    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({ password: '' })).status).toBe(400);
    expect((await request(server()).put('/api/users/me/password').set(...as(token)).send({})).status).toBe(400);
    expect((await request(server()).put('/api/users/me/password').send({ password: NEW_PASSWORD })).status).toBe(401);
  });

  it('GET /api/auth/me says whether the account has a password', async () => {
    const withPassword = await signUp('has-password', PASSWORD);
    const codeOnly = await signUp('code-only');

    const first = await request(server()).get('/api/auth/me').set(...as(withPassword.token)).expect(200);
    const second = await request(server()).get('/api/auth/me').set(...as(codeOnly.token)).expect(200);
    expect(first.body.hasPassword).toBe(true);
    expect(second.body.hasPassword).toBe(false);

    await request(server()).put('/api/users/me/password').set(...as(codeOnly.token)).send({ password: NEW_PASSWORD }).expect(204);
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

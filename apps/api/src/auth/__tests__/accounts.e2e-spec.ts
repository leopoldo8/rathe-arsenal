/**
 * Journey 1 account routes over HTTP against the local Postgres: what an address takes next,
 * sign-up with and without a password, one account per address however it is typed, refusals that
 * look alike, and the removed reset routes. Needs DATABASE_URL (see `accounts-e2e.fixture.ts`).
 */
import { existsSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { bootAccountsApp, IAccountsApp, PASSWORD, sessionCookieOf } from './accounts-e2e.fixture';
import { legacyJwtFor } from './session-test-helpers';

describe('Accounts (E2E, S30 and S31)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp();
  });

  afterAll(async () => {
    await ctx?.close();
    jest.clearAllMocks();
  });

  const server = (): ReturnType<IAccountsApp['app']['getHttpServer']> => ctx.app.getHttpServer();

  it('start says what comes next for each kind of address', async () => {
    const newcomer = ctx.emailFor('start-new');
    const codeOnly = ctx.emailFor('start-code');
    const withPassword = ctx.emailFor('start-password');
    await request(server()).post('/api/auth/sign-up').send({ email: codeOnly }).expect(201);
    await request(server()).post('/api/auth/sign-up').send({ email: withPassword, password: PASSWORD }).expect(201);

    const fresh = await request(server()).post('/api/auth/start').send({ email: newcomer }).expect(200);
    const code = await request(server()).post('/api/auth/start').send({ email: codeOnly }).expect(200);
    const password = await request(server()).post('/api/auth/start').send({ email: withPassword }).expect(200);
    const typedTwoWays = await request(server())
      .post('/api/auth/start')
      .send({ email: ` ${withPassword.toUpperCase()} ` })
      .expect(200);
    const malformed = await request(server()).post('/api/auth/start').send({ email: 'bia@gmail' }).expect(400);

    expect(fresh.body).toEqual({ next: 'new' });
    expect(code.body).toEqual({ next: 'code' });
    expect(password.body).toEqual({ next: 'password' });
    expect(typedTwoWays.body).toEqual({ next: 'password' });
    expect(typeof malformed.body.code).toBe('string');
    for (const response of [fresh, code, password, typedTwoWays, malformed]) {
      expect(sessionCookieOf(response)).toBeNull();
      expect(JSON.stringify(response.body)).not.toMatch(/jwt|token|session/i);
    }
  });

  it('sign-up without a password creates a signed-in account', async () => {
    const email = ctx.emailFor('signup-no-password');

    const res = await request(server()).post('/api/auth/sign-up').send({ email }).expect(201);

    expect(res.body.user.email).toBe(email);
    const cookie = sessionCookieOf(res);
    expect(cookie).not.toBeNull();
    const [row] = await ctx.dataSource.query(`SELECT "passwordHash", "emailVerifiedAt" FROM "user" WHERE "email" = $1`, [email]);
    expect(row).toEqual({ passwordHash: null, emailVerifiedAt: null });
    const me = await request(server()).get('/api/auth/me').set('Cookie', cookie as string).expect(200);
    expect(me.body.email).toBe(email);
  });

  it('a stale session cookie does not turn an old Bearer token into a session', async () => {
    const email = ctx.emailFor('stale-cookie');
    const signedUp = await request(server()).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);

    const refused = await request(server())
      .get('/api/auth/me')
      .set('Cookie', 'ra_session=not-a-valid-token')
      .set('Authorization', `Bearer ${legacyJwtFor(signedUp.body.user.id as string)}`);

    expect(refused.status).toBe(401);
  });

  it('sign-up keeps the in-app page it was made from and drops any other', async () => {
    const fromDeck = ctx.emailFor('return-deck');
    const fromElsewhere = ctx.emailFor('return-elsewhere');

    await request(server()).post('/api/auth/sign-up').send({ email: fromDeck, returnPath: '/d/abc123' }).expect(201);
    await request(server()).post('/api/auth/sign-up').send({ email: fromElsewhere, returnPath: 'https://evil.example/x' }).expect(201);

    const rows = await ctx.dataSource.query(`SELECT "email", "signupReturnPath" FROM "user" WHERE "email" = ANY($1)`, [[fromDeck, fromElsewhere]]);
    const byEmail = Object.fromEntries(rows.map((row: { email: string; signupReturnPath: string | null }) => [row.email, row.signupReturnPath]));
    expect(byEmail).toEqual({ [fromDeck]: '/d/abc123', [fromElsewhere]: null });
  });

  it('addresses are trimmed and lowercased on every auth route', async () => {
    const lower = ctx.emailFor('typed-two-ways');
    const typed = ` ${lower.replace('acct-typed', 'ACCT-Typed')}\t`;

    await request(server()).post('/api/auth/sign-up').send({ email: typed, password: PASSWORD }).expect(201);
    const [stored] = await ctx.dataSource.query(`SELECT "email" FROM "user" WHERE lower("email") = $1`, [lower]);
    const duplicate = await request(server()).post('/api/auth/sign-up').send({ email: lower, password: PASSWORD }).expect(409);
    const signedIn = await request(server()).post('/api/auth/sign-in').send({ email: lower.toUpperCase(), password: PASSWORD }).expect(200);
    const start = await request(server()).post('/api/auth/start').send({ email: lower.toUpperCase() }).expect(200);
    await request(server()).post('/api/auth/codes').send({ email: lower.toUpperCase() }).expect(202);

    expect(stored.email).toBe(lower);
    expect(duplicate.body.code).toBe('EMAIL_TAKEN');
    expect(signedIn.body.user.email).toBe(lower);
    expect(start.body).toEqual({ next: 'password' });
    expect(ctx.sentCodes.filter((sent) => sent.to === lower)).toHaveLength(1);
  });

  it('sign-in refuses wrong, missing and deleted alike', async () => {
    const withPassword = ctx.emailFor('refuse-password');
    const codeOnly = ctx.emailFor('refuse-code');
    const deleted = ctx.emailFor('refuse-deleted');
    await request(server()).post('/api/auth/sign-up').send({ email: withPassword, password: PASSWORD }).expect(201);
    await request(server()).post('/api/auth/sign-up').send({ email: codeOnly }).expect(201);
    await request(server()).post('/api/auth/sign-up').send({ email: deleted, password: PASSWORD }).expect(201);
    await ctx.dataSource.query(`UPDATE "user" SET "deletedAt" = now() WHERE "email" = $1`, [deleted]);

    const wrong = await request(server()).post('/api/auth/sign-in').send({ email: withPassword, password: 'not-the-password' });
    const missing = await request(server()).post('/api/auth/sign-in').send({ email: codeOnly, password: PASSWORD });
    const gone = await request(server()).post('/api/auth/sign-in').send({ email: deleted, password: PASSWORD });

    for (const response of [wrong, missing, gone]) {
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
      expect(sessionCookieOf(response)).toBeNull();
    }
    const bodyOf = (response: request.Response): object => ({ ...response.body, timestamp: undefined });
    expect(bodyOf(missing)).toEqual(bodyOf(wrong));
    expect(bodyOf(gone)).toEqual(bodyOf(wrong));
  });

  it('the reset routes are gone', async () => {
    const forgot = await request(server()).post('/api/auth/forgot-password').send({ email: ctx.emailFor('forgot') });
    const reset = await request(server())
      .post('/api/auth/reset-password')
      .send({ token: 'a'.repeat(64), newPassword: 'a-new-password-123' });

    expect(forgot.status).toBe(404);
    expect(reset.status).toBe(404);
    expect(existsSync(join(__dirname, '../../email/templates/password-reset-email.template.ts'))).toBe(false);
  });
});

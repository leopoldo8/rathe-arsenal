/**
 * Sign-in codes over HTTP against the local Postgres (door 15): stored hashed, spent once, replaced
 * by a newer request, refused when wrong, malformed, expired or exhausted.
 */
import request from 'supertest';
import { bootAccountsApp, IAccountsApp, PASSWORD, sessionCookieOf } from './accounts-e2e.fixture';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

describe('Sign-in codes (E2E, S31)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp();
  });

  afterAll(async () => {
    await ctx?.close();
    jest.clearAllMocks();
  });

  const server = (): ReturnType<IAccountsApp['app']['getHttpServer']> => ctx.app.getHttpServer();

  async function accountWithCodeFor(label: string): Promise<string> {
    const email = ctx.emailFor(label);
    await request(server()).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);
    return email;
  }

  async function requestCode(email: string): Promise<{ code: string; token: string }> {
    await request(server()).post('/api/auth/codes').send({ email }).expect(202);
    const sent = [...ctx.sentCodes].reverse().find((entry) => entry.to === email);
    if (!sent) throw new Error('no code e-mail was recorded');
    return { code: sent.code, token: new URL(sent.link).searchParams.get('token') ?? '' };
  }

  const liveRows = (email: string): Promise<{ id: string }[]> =>
    ctx.dataSource.query(`SELECT "id" FROM "sign_in_code" WHERE "email" = $1 AND "consumedAt" IS NULL`, [email]);

  it('a code request stores a hashed code and sends one e-mail', async () => {
    const email = await accountWithCodeFor('code-store');
    const before = Date.now();

    const res = await request(server()).post('/api/auth/codes').send({ email }).expect(202);

    const sent = ctx.sentCodes.filter((entry) => entry.to === email);
    expect(sent).toHaveLength(1);
    const [only] = sent;
    expect(only?.code).toMatch(/^\d{6}$/);
    const token = new URL(only?.link ?? '').searchParams.get('token') ?? '';
    expect(only?.link.startsWith('http://localhost:5173/')).toBe(true);
    const rows = await ctx.dataSource.query(`SELECT "codeHash", "buttonTokenHash" FROM "sign_in_code" WHERE "email" = $1`, [email]);
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toBe(only?.code);
    expect(rows[0].buttonTokenHash).not.toBe(token);
    expect(rows[0].codeHash).toHaveLength(64);
    const expiresAt = Date.parse(res.body.expiresAt);
    expect(Math.abs(expiresAt - (before + FIFTEEN_MINUTES_MS))).toBeLessThan(60_000);
    expect(Date.parse(res.body.resendAfter)).toBeGreaterThan(before);
  });

  it('the code and the button each sign in once', async () => {
    const email = await accountWithCodeFor('code-once');
    const first = await requestCode(email);

    const verified = await request(server()).post('/api/auth/codes/verify').send({ email, code: first.code }).expect(200);
    const replayed = await request(server()).post('/api/auth/codes/redeem').send({ token: first.token });

    expect(verified.body.user.email).toBe(email);
    expect(verified.body).toHaveProperty('returnPath');
    expect(sessionCookieOf(verified)).not.toBeNull();
    const [spent] = await ctx.dataSource.query(`SELECT "consumedAt" FROM "sign_in_code" WHERE "email" = $1`, [email]);
    expect(spent.consumedAt).not.toBeNull();
    expect(replayed.status).toBe(401);

    const second = await requestCode(email);
    const redeemed = await request(server()).post('/api/auth/codes/redeem').send({ token: second.token }).expect(200);
    const again = await request(server()).post('/api/auth/codes/redeem').send({ token: second.token });
    expect(redeemed.body.user.email).toBe(email);
    expect(sessionCookieOf(redeemed)).not.toBeNull();
    expect(again.status).toBe(401);

    const third = await requestCode(email);
    await ctx.dataSource.query(`UPDATE "sign_in_code" SET "expiresAt" = now() - interval '1 minute' WHERE "email" = $1 AND "consumedAt" IS NULL`, [email]);
    const late = await request(server()).post('/api/auth/codes/redeem').send({ token: third.token });
    expect(late.status).toBe(410);
    expect(late.body.code).toBe('TOKEN_EXPIRED');
  });

  it('a new code replaces the live one', async () => {
    const email = await accountWithCodeFor('code-replace');
    const first = await requestCode(email);
    expect(await liveRows(email)).toHaveLength(1);
    const second = await requestCode(email);
    expect(await liveRows(email)).toHaveLength(1);

    const stale = await request(server()).post('/api/auth/codes/verify').send({ email, code: first.code });
    const fresh = await request(server()).post('/api/auth/codes/verify').send({ email, code: second.code });

    expect(first.code).not.toBe(second.code);
    expect(stale.status).toBe(401);
    expect(fresh.status).toBe(200);
    expect(await liveRows(email)).toHaveLength(0);
  });

  it('wrong, malformed, expired and exhausted codes are refused', async () => {
    const email = await accountWithCodeFor('code-refused');
    const { code } = await requestCode(email);
    const wrong = code === '000000' ? '111111' : '000000';

    const wrongTry = await request(server()).post('/api/auth/codes/verify').send({ email, code: wrong });
    const malformed = await request(server()).post('/api/auth/codes/verify').send({ email, code: '12345' });
    expect(wrongTry.status).toBe(401);
    expect(wrongTry.body.code).toBe('INVALID_CODE');
    expect(malformed.status).toBe(400);

    await ctx.dataSource.query(`UPDATE "sign_in_code" SET "expiresAt" = now() - interval '1 minute' WHERE "email" = $1 AND "consumedAt" IS NULL`, [email]);
    const expired = await request(server()).post('/api/auth/codes/verify').send({ email, code });
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe('TOKEN_EXPIRED');

    const exhaustedEmail = await accountWithCodeFor('code-exhausted');
    const real = await requestCode(exhaustedEmail);
    const bad = real.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await request(server()).post('/api/auth/codes/verify').send({ email: exhaustedEmail, code: bad }).expect(401);
    }
    const afterFive = await request(server()).post('/api/auth/codes/verify').send({ email: exhaustedEmail, code: real.code });
    expect(afterFive.status).toBe(401);
    expect(sessionCookieOf(afterFive)).toBeNull();
  });

  it('concurrent wrong tries cannot pass the cap of 5', async () => {
    const email = await accountWithCodeFor('code-race');
    const real = await requestCode(email);
    const bad = real.code === '000000' ? '111111' : '000000';

    const burst = await Promise.all(
      Array.from({ length: 30 }, () => request(server()).post('/api/auth/codes/verify').send({ email, code: bad })),
    );
    const afterBurst = await request(server()).post('/api/auth/codes/verify').send({ email, code: real.code });

    expect(burst.every((res) => res.status === 401)).toBe(true);
    const rows = await ctx.dataSource.query(`SELECT "attempts" FROM "sign_in_code" WHERE "email" = $1`, [email]);
    expect(rows[0].attempts).toBeLessThanOrEqual(5);
    expect(afterBurst.status).toBe(401);
    expect(sessionCookieOf(afterBurst)).toBeNull();
  });

  it('a right code racing wrong ones signs in at most once and never past 5 tries', async () => {
    const email = await accountWithCodeFor('code-race-right');
    const real = await requestCode(email);
    const bad = real.code === '000000' ? '111111' : '000000';
    const codes = [...Array.from({ length: 30 }, () => bad), real.code];

    const burst = await Promise.all(codes.map((code) => request(server()).post('/api/auth/codes/verify').send({ email, code })));

    expect(burst.filter((res) => res.status === 200).length).toBeLessThanOrEqual(1);
    const rows = await ctx.dataSource.query(`SELECT "attempts" FROM "sign_in_code" WHERE "email" = $1`, [email]);
    expect(rows[0].attempts).toBeLessThanOrEqual(5);
  });
});

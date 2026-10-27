/**
 * S34 over HTTP with the throttler on: Turnstile on sign-up and code requests, five codes per
 * address and twenty sign-ups per IP per hour. Needs DATABASE_URL (see `accounts-e2e.fixture.ts`).
 */
import { Logger } from '@nestjs/common';
import request from 'supertest';
import { bootAccountsApp, IAccountsApp, PASSWORD } from './accounts-e2e.fixture';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

describe('Auth limits (E2E, S34)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp({ throttle: true });
  });

  afterAll(async () => {
    delete process.env['TURNSTILE_SECRET_KEY'];
    await ctx?.close();
    jest.restoreAllMocks();
  });

  const server = (): ReturnType<IAccountsApp['app']['getHttpServer']> => ctx.app.getHttpServer();
  const from = (ip: string, path: string): request.Test => request(server()).post(path).set('X-Forwarded-For', ip);

  async function countOf(table: 'user' | 'sign_in_code', email: string): Promise<number> {
    const [row] = (await ctx.dataSource.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE "email" = $1`, [email])) as [{ n: number }];
    return row.n;
  }

  // Runs first: the missing-secret warning is kept once an hour, so a later test would find it already given.
  it('with no Turnstile secret sign-up answers 201 without calling siteverify and the warning comes once', async () => {
    expect(process.env['TURNSTILE_SECRET_KEY']).toBeUndefined();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      for (let i = 0; i < 3; i++) {
        await from('198.51.100.90', '/api/auth/sign-up').send({ email: ctx.emailFor(`no-secret-${i}`), password: PASSWORD, turnstileToken: 'anything' }).expect(201);
      }
      await from('198.51.100.91', '/api/auth/codes').send({ email: ctx.emailFor('no-secret-0') }).expect(202);

      expect(fetchSpy.mock.calls.filter(([url]) => url === SITEVERIFY_URL)).toHaveLength(0);
      const missingSecretWarnings = warnSpy.mock.calls.filter(([entry]) => (entry as { event?: string } | undefined)?.event === 'auth.turnstile.secret_missing');
      expect(missingSecretWarnings).toHaveLength(1);
    } finally {
      fetchSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('five codes per address and twenty sign-ups per IP per hour', async () => {
    const email = ctx.emailFor('five-codes');
    const other = ctx.emailFor('five-codes-other');
    for (const address of [email, other]) {
      await from('198.51.100.20', '/api/auth/sign-up').send({ email: address, password: PASSWORD }).expect(201);
    }

    for (let i = 0; i < 5; i++) {
      await from('198.51.100.21', '/api/auth/codes').send({ email }).expect(202);
    }
    const sixth = await from('198.51.100.21', '/api/auth/codes').send({ email });
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(3500);
    expect(await countOf('sign_in_code', email)).toBe(5);
    await from('198.51.100.21', '/api/auth/codes').send({ email: other }).expect(202);

    const signUps: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await from('198.51.100.30', '/api/auth/sign-up').send({ email: ctx.emailFor(`twenty-${i}`), password: PASSWORD });
      signUps.push(res.status);
    }
    expect(signUps[19]).toBe(201);
    expect(signUps[20]).toBe(429);
  });

  it('ten failed tries per address per hour across codes', async () => {
    const email = ctx.emailFor('ten-failed');
    await from('198.51.100.100', '/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);
    let ipCounter = 0;
    const failTries = async (count: number): Promise<void> => {
      const sent = [...ctx.sentCodes].reverse().find((entry) => entry.to === email);
      const wrong = `${sent?.code.slice(0, 5)}${(Number(sent?.code[5]) + 1) % 10}`;
      for (let i = 0; i < count; i++) {
        await from(`198.51.101.${(ipCounter += 1)}`, '/api/auth/codes/verify').send({ email, code: wrong }).expect(401);
      }
    };

    await from('198.51.100.101', '/api/auth/codes').send({ email }).expect(202);
    await failTries(5);
    await from('198.51.100.102', '/api/auth/codes').send({ email }).expect(202);
    await failTries(4);
    // 9 failed tries: the next request still answers 202.
    await from('198.51.100.103', '/api/auth/codes').send({ email }).expect(202);
    await failTries(1);

    // 10 failed tries across three codes, none of them untried: the next request is refused.
    const rowsBefore = await countOf('sign_in_code', email);
    const refused = await from('198.51.100.104', '/api/auth/codes').send({ email });
    expect(refused.status).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(refused.headers['retry-after'])).toBeLessThanOrEqual(3600);
    expect(await countOf('sign_in_code', email)).toBe(rowsBefore);
  });

  it('a code that has had a try does not count toward the five', async () => {
    const email = ctx.emailFor('tried-not-counted');
    await from('198.51.100.110', '/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);

    for (let i = 0; i < 4; i++) {
      await from('198.51.100.111', '/api/auth/codes').send({ email }).expect(202);
    }
    const sent = [...ctx.sentCodes].reverse().find((entry) => entry.to === email);
    const wrong = `${sent?.code.slice(0, 5)}${(Number(sent?.code[5]) + 1) % 10}`;
    await from('198.51.100.112', '/api/auth/codes/verify').send({ email, code: wrong }).expect(401);

    // Four codes asked, one of them tried: only three count, so two more requests fit.
    await from('198.51.100.111', '/api/auth/codes').send({ email }).expect(202);
    await from('198.51.100.111', '/api/auth/codes').send({ email }).expect(202);
    const refused = await from('198.51.100.111', '/api/auth/codes').send({ email });
    expect(refused.status).toBe(429);
    expect(await countOf('sign_in_code', email)).toBe(6);
  });

  it('parallel code requests cannot pass the five-per-address limit together', async () => {
    const email = ctx.emailFor('parallel-codes');
    await from('198.51.100.70', '/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);

    const answers = await Promise.all(Array.from({ length: 12 }, () => from('198.51.100.71', '/api/auth/codes').send({ email })));

    expect(answers.filter((answer) => answer.status === 202)).toHaveLength(5);
    expect(answers.filter((answer) => answer.status === 429)).toHaveLength(7);
    expect(await countOf('sign_in_code', email)).toBe(5);
  });

  it('asking for a new code does not give a guesser more than ten tries per hour', async () => {
    const email = ctx.emailFor('fresh-tries');
    await from('198.51.100.40', '/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);

    let wrongTries = 0;
    for (let round = 0; round < 2; round++) {
      const ip = `198.51.100.${50 + round}`;
      await from(ip, '/api/auth/codes').send({ email }).expect(202);
      const sent = [...ctx.sentCodes].reverse().find((entry) => entry.to === email);
      const wrong = `${sent?.code.slice(0, 5)}${(Number(sent?.code[5]) + 1) % 10}`;
      for (let attempt = 0; attempt < 5; attempt++) {
        await from(ip, '/api/auth/codes/verify').send({ email, code: wrong }).expect(401);
        wrongTries += 1;
      }
    }

    expect(wrongTries).toBe(10);
    await from('198.51.100.60', '/api/auth/codes').send({ email }).expect(429);
  });

  // Runs last: the config service keeps the secret it first read from the environment.
  it('Turnstile decides sign-up and code requests when the secret is set', async () => {
    process.env['TURNSTILE_SECRET_KEY'] = 'turnstile-test-secret';
    const known = ctx.emailFor('captcha-known');
    const fetchSpy = jest.spyOn(global, 'fetch');
    try {
      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false }) } as Response);
      const refusedEmail = ctx.emailFor('captcha-refused');
      const refusedSignUp = await from('198.51.100.11', '/api/auth/sign-up').send({ email: refusedEmail, password: PASSWORD, turnstileToken: 'bad' });
      expect(refusedSignUp.status).toBe(400);
      expect(refusedSignUp.body.code).toBe('CAPTCHA_FAILED');
      expect(await countOf('user', refusedEmail)).toBe(0);

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) } as Response);
      await from('198.51.100.12', '/api/auth/sign-up').send({ email: known, password: PASSWORD, turnstileToken: 'good' }).expect(201);

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false }) } as Response);
      const refusedCode = await from('198.51.100.13', '/api/auth/codes').send({ email: known, turnstileToken: 'bad' });
      expect(refusedCode.status).toBe(400);
      expect(refusedCode.body.code).toBe('CAPTCHA_FAILED');
      expect(await countOf('sign_in_code', known)).toBe(0);

      fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) } as Response);
      await from('198.51.100.14', '/api/auth/codes').send({ email: known, turnstileToken: 'good' }).expect(202);

      const calls = fetchSpy.mock.calls.filter(([url]) => url === SITEVERIFY_URL);
      const [, lastInit] = calls[calls.length - 1] as [string, RequestInit];
      expect(lastInit.method).toBe('POST');
      const sent = new URLSearchParams(String(lastInit.body));
      expect([sent.get('secret'), sent.get('response')]).toEqual(['turnstile-test-secret', 'good']);
    } finally {
      fetchSpy.mockRestore();
      delete process.env['TURNSTILE_SECRET_KEY'];
    }
  });
});

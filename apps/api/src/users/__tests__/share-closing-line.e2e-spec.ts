/**
 * S18 over HTTP against the local Postgres: the closing line of the group ask is kept on the account.
 * Needs DATABASE_URL (see `auth/__tests__/accounts-e2e.fixture.ts`).
 */
import request from 'supertest';
import { bootAccountsApp, IAccountsApp } from '../../auth/__tests__/accounts-e2e.fixture';
import { sessionCookieHeader, sessionTokenOf } from '../../auth/__tests__/session-test-helpers';

describe('Share closing line (E2E, S18)', () => {
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

  async function signUp(label: string): Promise<{ email: string; token: string }> {
    const email = ctx.emailFor(label);
    const response = await request(server()).post('/api/auth/sign-up').send({ email }).expect(201);
    return { email, token: sessionTokenOf(response) };
  }

  async function storedLine(email: string): Promise<string | null> {
    const [row] = (await ctx.dataSource.query(`SELECT "shareClosingLine" FROM "user" WHERE "email" = $1`, [email])) as [
      { shareClosingLine: string | null },
    ];
    return row.shareClosingLine;
  }

  it('stores the closing line up to 140 characters', async () => {
    const { email, token } = await signUp('closing-line');
    const line = 'x'.repeat(140);

    const saved = await request(server()).patch('/api/users/me/share-closing-line').set(...as(token)).send({ text: line });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ text: line });
    expect(await storedLine(email)).toBe(line);

    const tooLong = await request(server()).patch('/api/users/me/share-closing-line').set(...as(token)).send({ text: 'y'.repeat(141) });
    const notText = await request(server()).patch('/api/users/me/share-closing-line').set(...as(token)).send({ text: 7 });
    const missing = await request(server()).patch('/api/users/me/share-closing-line').set(...as(token)).send({});
    expect([tooLong.status, notText.status, missing.status]).toEqual([400, 400, 400]);
    expect(await storedLine(email)).toBe(line);
  });

  it('answers 401 with no session and shows the line on /auth/me', async () => {
    const { token } = await signUp('closing-line-me');
    expect((await request(server()).patch('/api/users/me/share-closing-line').send({ text: 'oi' })).status).toBe(401);

    await request(server()).patch('/api/users/me/share-closing-line').set(...as(token)).send({ text: 'Pago no PIX.' }).expect(200);

    const me = await request(server()).get('/api/auth/me').set(...as(token)).expect(200);
    expect(me.body.shareClosingLine).toBe('Pago no PIX.');
  });
});

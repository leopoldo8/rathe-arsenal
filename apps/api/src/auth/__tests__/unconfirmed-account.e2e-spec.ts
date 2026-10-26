/**
 * S33 over HTTP against the local Postgres: what an account can do before its e-mail is confirmed,
 * the 7-day confirmation, the page it returns to, fixing a mistyped address and a failed e-mail.
 * Needs DATABASE_URL (see `accounts-e2e.fixture.ts`).
 */
import request from 'supertest';
import { bootAccountsApp, IAccountsApp, PASSWORD } from './accounts-e2e.fixture';
import { sessionCookieHeader, sessionTokenOf, setCookiesOf } from './session-test-helpers';

const SEVEN_DAYS_SECONDS = 604_800;
const HOUR_MS = 60 * 60 * 1000;
const TYPED_FIX = 'Bia.Nova@gmail.com';
const LOWERCASED_FIX = 'bia.nova@gmail.com';

describe('An account that has not confirmed its e-mail (E2E, S33)', () => {
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

  interface ISignedUp {
    readonly email: string;
    readonly userId: string;
    readonly token: string;
    readonly confirmationToken: string;
    readonly response: request.Response;
  }

  async function signUp(label: string, body: Record<string, unknown> = {}): Promise<ISignedUp> {
    const email = ctx.emailFor(label);
    const response = await request(server())
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD, ...body })
      .expect(201);
    const link = response.body._devVerificationLink as string | undefined;
    return {
      email,
      userId: response.body.user.id as string,
      token: sessionTokenOf(response),
      confirmationToken: new URL(link ?? 'http://x/?token=').searchParams.get('token') ?? '',
      response,
    };
  }

  async function createDeck(account: ISignedUp): Promise<number> {
    const [deck] = (await ctx.dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Unconfirmed deck', 'Some Hero', NULL, 'cc', 'building') RETURNING id`,
      [account.userId],
    )) as [{ id: number }];
    // One collection row of 3 copies, so a fix of the address can be seen to keep the collection.
    const [source] = (await ctx.dataSource.query(`INSERT INTO csv_source ("userId", kind, active) VALUES ($1, 'manual', true) RETURNING id`, [account.userId])) as [{ id: string }];
    await ctx.dataSource.query(`INSERT INTO collection_card ("userId", "cardIdentifier", quantity, "sourceId", finish) VALUES ($1, 'flex-red', 3, $2, '')`, [account.userId, source.id]);
    return deck.id;
  }

  async function collectionOf(account: ISignedUp): Promise<{ rows: number; copies: number }> {
    const [row] = (await ctx.dataSource.query(
      `SELECT COUNT(*)::int AS rows, COALESCE(SUM(quantity), 0)::int AS copies FROM collection_card WHERE "userId" = $1`,
      [account.userId],
    )) as [{ rows: number; copies: number }];
    return row;
  }

  async function createList(account: ISignedUp): Promise<number> {
    const res = await request(server()).post('/api/lists').set(...as(account.token)).send({ kind: 'want', name: 'Wants' }).expect(201);
    return res.body.id as number;
  }

  async function countShareLinks(account: ISignedUp): Promise<number> {
    const [row] = (await ctx.dataSource.query(`SELECT COUNT(*)::int AS n FROM share_link WHERE "ownerUserId" = $1`, [account.userId])) as [{ n: number }];
    return row.n;
  }

  it('an unconfirmed account can do everything but create a share link', async () => {
    const account = await signUp('everything-but-share');
    const signedIn = await request(server()).post('/api/auth/sign-in').send({ email: account.email, password: PASSWORD });
    expect(signedIn.status).toBe(200);
    await request(server()).patch('/api/users/me/display-name').set(...as(account.token)).send({ displayName: 'Bia' }).expect(200);

    expect((await request(server()).get('/api/decks').set(...as(account.token))).status).toBe(200);
    const created = await request(server())
      .post('/api/decks')
      .set(...as(account.token))
      .send({ heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' });
    expect(created.status).toBe(201);
    const deckId = created.body.id as number;
    const listId = await createList(account);

    const deckShare = await request(server()).post(`/api/decks/${deckId}/share`).set(...as(account.token)).send({ intent: 'deck' });
    const listShare = await request(server()).post(`/api/lists/${listId}/share`).set(...as(account.token)).send({});
    expect(deckShare.status).toBe(403);
    expect(deckShare.body.code).toBe('EMAIL_NOT_CONFIRMED');
    expect(listShare.status).toBe(403);
    expect(listShare.body.code).toBe('EMAIL_NOT_CONFIRMED');
    expect(await countShareLinks(account)).toBe(0);

    await ctx.dataSource.query(`UPDATE "user" SET "emailVerifiedAt" = now() WHERE id = $1`, [account.userId]);
    expect((await request(server()).post(`/api/decks/${deckId}/share`).set(...as(account.token)).send({ intent: 'deck' })).status).toBe(201);
    expect((await request(server()).post(`/api/lists/${listId}/share`).set(...as(account.token)).send({})).status).toBe(201);
    expect(await countShareLinks(account)).toBe(2);
  });

  it('the confirmation lasts 7 days and an old one deletes nothing', async () => {
    const account = await signUp('seven-days');
    const deckId = await createDeck(account);
    const [issued] = (await ctx.dataSource.query(
      `SELECT EXTRACT(EPOCH FROM ("verificationTokenExpiresAt" - "createdAt"))::int AS seconds FROM "user" WHERE id = $1`,
      [account.userId],
    )) as [{ seconds: number }];
    expect(issued.seconds).toBeGreaterThanOrEqual(SEVEN_DAYS_SECONDS);
    expect(issued.seconds).toBeLessThanOrEqual(SEVEN_DAYS_SECONDS + 5);

    const setExpiry = (offsetMs: number): Promise<unknown> =>
      ctx.dataSource.query(`UPDATE "user" SET "verificationTokenExpiresAt" = now() + ($2 || ' milliseconds')::interval WHERE id = $1`, [account.userId, String(offsetMs)]);

    await setExpiry(HOUR_MS);
    const confirmed = await request(server()).post('/api/auth/verify-email').send({ token: account.confirmationToken });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.verified).toBe(true);

    const late = await signUp('seven-days-late');
    const lateDeck = await createDeck(late);
    await ctx.dataSource.query(`UPDATE "user" SET "verificationTokenExpiresAt" = now() - interval '1 second' WHERE id = $1`, [late.userId]);
    const expired = await request(server()).post('/api/auth/verify-email').send({ token: late.confirmationToken });
    expect(expired.status).toBe(410);
    expect(expired.body.code).toBe('TOKEN_EXPIRED');

    const [row] = (await ctx.dataSource.query(`SELECT "emailVerifiedAt" FROM "user" WHERE id = $1`, [late.userId])) as [{ emailVerifiedAt: Date | null }];
    expect(row.emailVerifiedAt).toBeNull();
    const [decks] = (await ctx.dataSource.query(`SELECT COUNT(*)::int AS n FROM tracked_deck WHERE id = ANY($1)`, [[deckId, lateDeck]])) as [{ n: number }];
    expect(decks.n).toBe(2);
  });

  it('confirming returns the page stored at sign-up', async () => {
    const account = await signUp('return-path', { returnPath: '/d/aB3dE5gH7jK9mN' });
    const noPage = await signUp('return-none');

    const confirmed = await request(server()).post('/api/auth/verify-email').send({ token: account.confirmationToken });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toMatchObject({ verified: true, returnPath: '/d/aB3dE5gH7jK9mN', email: account.email });
    expect(setCookiesOf(confirmed)).toHaveLength(0);

    const plain = await request(server()).post('/api/auth/verify-email').send({ token: noPage.confirmationToken }).expect(200);
    expect(plain.body.returnPath).toBeNull();
  });

  it('fixing the address keeps the account and sends a new confirmation', async () => {
    const account = await signUp('fix-address');
    const deckId = await createDeck(account);
    const collectionBefore = await collectionOf(account);
    expect(collectionBefore).toEqual({ rows: 1, copies: 3 });
    const sentBefore = ctx.sentConfirmations.length;

    // The address a person types with capitals; the account keeps it lowercased. A leftover from an aborted run is cleared first.
    await ctx.dataSource.query(`DELETE FROM "user" WHERE "email" = $1`, [LOWERCASED_FIX]);
    const fixed = await request(server()).patch('/api/auth/me/email').set(...as(account.token)).send({ email: TYPED_FIX });
    try {
      expect(fixed.status).toBe(200);
      expect(fixed.body.user.email).toBe(LOWERCASED_FIX);

      const [kept] = (await ctx.dataSource.query(`SELECT COUNT(*)::int AS n FROM tracked_deck WHERE id = $1 AND "userId" = $2`, [deckId, account.userId])) as [{ n: number }];
      expect(kept.n).toBe(1);
      expect(await collectionOf(account)).toEqual(collectionBefore);
      const me = await request(server()).get('/api/auth/me').set(...as(account.token)).expect(200);
      expect(me.body.email).toBe(LOWERCASED_FIX);
      expect(ctx.sentConfirmations).toHaveLength(sentBefore + 1);
      const sent = ctx.sentConfirmations[ctx.sentConfirmations.length - 1];
      expect(sent?.to).toBe(LOWERCASED_FIX);

      const old = await request(server()).post('/api/auth/verify-email').send({ token: account.confirmationToken });
      expect(old.status).toBe(410);
      const fresh = new URL(sent?.link ?? '').searchParams.get('token');
      expect((await request(server()).post('/api/auth/verify-email').send({ token: fresh })).status).toBe(200);

      const confirmedChange = await request(server()).patch('/api/auth/me/email').set(...as(account.token)).send({ email: ctx.emailFor('another-new') });
      expect(confirmedChange.status).toBe(400);

      const other = await signUp('fix-address-other');
      const taken = await request(server()).patch('/api/auth/me/email').set(...as(other.token)).send({ email: LOWERCASED_FIX });
      expect(taken.status).toBe(409);
      const malformed = await request(server()).patch('/api/auth/me/email').set(...as(other.token)).send({ email: 'bia@gmail' });
      expect(malformed.status).toBe(400);
      const noCookie = await request(server()).patch('/api/auth/me/email').send({ email: ctx.emailFor('someone') });
      expect(noCookie.status).toBe(401);
    } finally {
      await ctx.dataSource.query(`DELETE FROM "user" WHERE "email" = $1`, [LOWERCASED_FIX]);
    }
  });

  it('a failed confirmation e-mail does not block the account', async () => {
    ctx.failConfirmations = true;
    let account: ISignedUp;
    try {
      account = await signUp('mail-down');
    } finally {
      ctx.failConfirmations = false;
    }
    expect(sessionTokenOf(account.response)).toBeTruthy();
    const [row] = (await ctx.dataSource.query(`SELECT COUNT(*)::int AS n FROM "user" WHERE id = $1`, [account.userId])) as [{ n: number }];
    expect(row.n).toBe(1);
    expect((await request(server()).get('/api/auth/me').set(...as(account.token))).status).toBe(200);

    const sentBefore = ctx.sentConfirmations.length;
    const resent = await request(server()).post('/api/auth/resend-verification').set(...as(account.token));
    expect(resent.status).toBe(202);
    expect(ctx.sentConfirmations).toHaveLength(sentBefore + 1);
    expect(ctx.sentConfirmations[sentBefore]?.to).toBe(account.email);

    const noCookie = await request(server()).post('/api/auth/resend-verification');
    expect(noCookie.status).toBe(401);
  });
  it('a confirmation token is spent once even when used in parallel', async () => {
    const account = await signUp('parallel-token');

    const answers = await Promise.all(
      Array.from({ length: 6 }, () => request(server()).post('/api/auth/verify-email').send({ token: account.confirmationToken })),
    );

    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 410, 410, 410, 410, 410]);
  });

  it('an old token cannot confirm the address that "Errei o e-mail" just moved to', async () => {
    for (let round = 0; round < 8; round++) {
      const account = await signUp(`token-vs-fix-${round}`);
      const newEmail = ctx.emailFor(`token-vs-fix-new-${round}`);

      await Promise.all([
        request(server()).post('/api/auth/verify-email').send({ token: account.confirmationToken }),
        request(server()).patch('/api/auth/me/email').set(...as(account.token)).send({ email: newEmail }),
      ]);

      const [row] = (await ctx.dataSource.query(`SELECT email, "emailVerifiedAt" FROM "user" WHERE id = $1`, [account.userId])) as [
        { email: string; emailVerifiedAt: Date | null },
      ];
      expect(row.email === newEmail && row.emailVerifiedAt !== null).toBe(false);
    }
  });
});

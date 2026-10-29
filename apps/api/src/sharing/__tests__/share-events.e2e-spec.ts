/**
 * Share events over HTTP against the local Postgres: what a visitor of a shared deck address records
 * (`offer` on the `missing` page, `quote_sent` on the `quote` page). Needs DATABASE_URL like the other e2e specs.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureHttpApp } from '../../http/configure-http-app';
import { sessionCookieHeader, sessionTokenOf } from '../../auth/__tests__/session-test-helpers';

const PASSWORD = 'share-events-password-123';
const SUFFIX = Date.now().toString(36);
const emailFor = (label: string): string => `share-events-${label}-${SUFFIX}@test.local`;

interface ISession {
  readonly userId: string;
  readonly sessionToken: string;
}

interface IEventRow {
  readonly kind: string;
  readonly intent: string | null;
  readonly actorUserId: string | null;
}

describe('Share events (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const auth = (session: ISession): [string, string] => ['Cookie', sessionCookieHeader(session.sessionToken)];

  async function createSession(label: string): Promise<ISession> {
    const signUp = await request(server).post('/api/auth/sign-up').send({ email: emailFor(label), password: PASSWORD }).expect(201);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    return { userId: signUp.body.user.id as string, sessionToken: sessionTokenOf(signUp) };
  }

  async function shareDeck(owner: ISession, intent: 'missing' | 'quote'): Promise<{ deckId: number; token: string }> {
    const [deck] = (await dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Events deck', 'Some Hero', NULL, 'cc', 'building') RETURNING id`,
      [owner.userId],
    )) as [{ id: number }];
    await request(server).patch('/api/users/me/display-name').set(...auth(owner)).send({ displayName: 'Rodrigo' }).expect(200);
    const created = await request(server).post(`/api/decks/${deck.id}/share`).set(...auth(owner)).send({ intent }).expect(201);
    return { deckId: deck.id, token: created.body.token as string };
  }

  async function eventsOf(ownerUserId: string, kinds: readonly string[]): Promise<IEventRow[]> {
    return dataSource.query(
      `SELECT kind, intent, "actorUserId" FROM share_event WHERE "ownerUserId" = $1 AND kind = ANY($2) ORDER BY id`,
      [ownerUserId, kinds],
    );
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureHttpApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email LIKE $1`, [`share-events-%-${SUFFIX}@test.local`]);
    }
    await app?.close();
    jest.clearAllMocks();
  });

  it('records an offer for a visitor and nothing for the owner', async () => {
    const owner = await createSession('offer-owner');
    const visitor = await createSession('offer-visitor');
    const { token } = await shareDeck(owner, 'missing');

    await request(server).post(`/api/shared/decks/${token}/events`).set(...auth(visitor)).send({ kind: 'offer' }).expect(204);
    await request(server).post(`/api/shared/decks/${token}/events`).send({ kind: 'offer' }).expect(204);
    await request(server).post(`/api/shared/decks/${token}/events`).set(...auth(owner)).send({ kind: 'offer' }).expect(204);

    expect(await eventsOf(owner.userId, ['offer'])).toEqual([
      { kind: 'offer', intent: 'missing', actorUserId: visitor.userId },
      { kind: 'offer', intent: 'missing', actorUserId: null },
    ]);
  });

  it('refuses unknown kinds and dead tokens', async () => {
    const owner = await createSession('refuse-owner');
    const { deckId, token } = await shareDeck(owner, 'missing');
    const post = (url: string, body: object) => request(server).post(url).send(body);

    await post(`/api/shared/decks/${token}/events`, { kind: 'opened' }).expect(400);
    await post(`/api/shared/decks/${token}/events`, { kind: 'bogus' }).expect(400);
    await post(`/api/shared/decks/${token}/events`, { kind: 'buy' }).expect(400);
    await post(`/api/shared/decks/${token}/events`, {}).expect(400);
    await post(`/api/shared/decks/${token}/events`, { kind: 'offer', quantity: 3 }).expect(400);
    expect(await eventsOf(owner.userId, ['offer', 'opened', 'buy'])).toEqual([]);

    await post('/api/shared/decks/not-a-token/events', { kind: 'offer' }).expect(404);
    await post(`/api/shared/decks/${'a'.repeat(32)}/events`, { kind: 'offer' }).expect(404);
    await request(server).delete(`/api/decks/${deckId}/share/missing`).set(...auth(owner)).expect(204);
    const dead = await post(`/api/shared/decks/${token}/events`, { kind: 'offer' }).expect(404);
    expect(dead.body.code).toBe('SHARE_LINK_UNAVAILABLE');
  });

  it('records quote_sent without content', async () => {
    const owner = await createSession('quote-owner');
    const visitor = await createSession('quote-visitor');
    const { token } = await shareDeck(owner, 'quote');

    await request(server).post(`/api/shared/decks/${token}/events`).send({ kind: 'quote_sent' }).expect(204);
    await request(server).post(`/api/shared/decks/${token}/events`).set(...auth(visitor)).send({ kind: 'quote_sent' }).expect(204);
    await request(server).post(`/api/shared/decks/${token}/events`).set(...auth(owner)).send({ kind: 'quote_sent' }).expect(204);
    await request(server).post(`/api/shared/decks/${token}/events`).send({ kind: 'quote_sent', quantity: 18, cents: 41200, note: 'NM' }).expect(400);
    await request(server).post(`/api/shared/decks/${token}/events`).send({ kind: 'quote_sent', total: '412,00' }).expect(400);

    expect(await eventsOf(owner.userId, ['quote_sent'])).toEqual([
      { kind: 'quote_sent', intent: 'quote', actorUserId: null },
      { kind: 'quote_sent', intent: 'quote', actorUserId: visitor.userId },
    ]);
    const stored = (await dataSource.query(`SELECT * FROM share_event WHERE "ownerUserId" = $1 AND kind = 'quote_sent' LIMIT 1`, [owner.userId])) as Array<Record<string, unknown>>;
    expect(Object.keys(stored[0]!).sort()).toEqual(['actorUserId', 'id', 'intent', 'kind', 'occurredAt', 'ownerUserId', 'targetId', 'targetKind']);
  });
});

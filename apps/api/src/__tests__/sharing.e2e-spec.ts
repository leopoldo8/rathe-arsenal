/**
 * Sharing E2E: share on/off lifecycle, public shared deck, attribution events,
 * coverage, copy and sign-up attribution. Needs a real Postgres (DATABASE_URL)
 * with NODE_ENV=development so TypeORM synchronizes the schema, like the other e2e specs.
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { AppModule } from '../app.module';
import { configureHttpApp } from '../http/configure-http-app';

const PASSWORD = 'sharing-test-password-123';
const SUFFIX = Date.now().toString(36);
const emailFor = (label: string): string => `share-e2e-${label}-${SUFFIX}@test.local`;

const [CARD_A, CARD_B] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero')
  .slice(0, 2) as [ICatalogCard, ICatalogCard];

interface ISession {
  readonly userId: string;
  readonly jwt: string;
}

describe('Sharing (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const auth = (session: ISession): [string, string] => ['Authorization', `Bearer ${session.jwt}`];

  function signUpRaw(email: string, shareToken?: string): request.Test {
    return request(server)
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD, ...(shareToken ? { shareToken } : {}) });
  }

  async function createSession(label: string): Promise<ISession> {
    const email = emailFor(label);
    const signUp = await signUpRaw(email).expect(202);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    const verified = await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    return { userId: verified.body.user.id as string, jwt: verified.body.jwt as string };
  }

  async function createDeck(session: ISession): Promise<number> {
    const [deck] = (await dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Shared test deck', 'Some Hero', NULL, 'cc', 'building') RETURNING id`,
      [session.userId],
    )) as [{ id: number }];
    await dataSource.query(
      `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, slot)
       VALUES ($1, $2, 3, 'mainboard'), ($1, $3, 1, 'mainboard')`,
      [deck.id, CARD_A.cardIdentifier, CARD_B.cardIdentifier],
    );
    return deck.id;
  }

  async function ownCopies(session: ISession, cardIdentifier: string, quantity: number): Promise<void> {
    const [source] = (await dataSource.query(
      `INSERT INTO csv_source ("userId", kind, active) VALUES ($1, 'manual', true) RETURNING id`,
      [session.userId],
    )) as [{ id: string }];
    await dataSource.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", quantity, "sourceId") VALUES ($1, $2, $3, $4)`,
      [session.userId, cardIdentifier, quantity, source.id],
    );
  }

  async function countEvents(kind: string, ownerUserId: string): Promise<number> {
    const rows = (await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM share_event WHERE kind = $1 AND "ownerUserId" = $2`,
      [kind, ownerUserId],
    )) as { n: number }[];
    return rows[0]?.n ?? 0;
  }

  async function startSharing(session: ISession, deckId: number): Promise<string> {
    await request(server).patch('/api/users/me/display-name').set(...auth(session)).send({ displayName: 'Rodrigo' }).expect(200);
    const res = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(session)).send({}).expect(200);
    return res.body.token as string;
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    // The guard is an APP_GUARD, which overrideProvider cannot reach.
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = configureHttpApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email LIKE $1`, [`share-e2e-%-${SUFFIX}@test.local`]);
    }
    await app?.close();
    jest.clearAllMocks();
  });

  it('turns sharing on, on again, off and on again, and the old link dies', async () => {
    const owner = await createSession('lifecycle');
    const deckId = await createDeck(owner);

    const blocked = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({}).expect(409);
    expect(blocked.body.code).toBe('DISPLAY_NAME_REQUIRED');

    const first = await startSharing(owner, deckId);
    const again = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({}).expect(200);
    expect(again.body.token).toBe(first);
    expect(again.body.url).toBe(`http://localhost:5173/d/${first}`);
    expect(await countEvents('created', owner.userId)).toBe(1);

    const state = await request(server).get(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(200);
    expect(state.body).toEqual({ url: again.body.url, token: first, showContact: true });
    await request(server).get(`/api/shared/decks/${first}`).expect(200);

    await request(server).delete(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(204);
    await request(server).get(`/api/shared/decks/${first}`).expect(404);
    const off = await request(server).get(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(200);
    expect(off.body).toEqual({ url: null, token: null, showContact: true });

    const second = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({}).expect(200);
    expect(second.body.token).not.toBe(first);
    await request(server).get(`/api/shared/decks/${first}`).expect(404);
    await request(server).get(`/api/shared/decks/${second.body.token}`).expect(200);
    expect(await countEvents('created', owner.userId)).toBe(2);
  });

  it('keeps sharing controls to the deck owner', async () => {
    const owner = await createSession('ownership');
    const stranger = await createSession('stranger');
    const deckId = await createDeck(owner);

    await request(server).post(`/api/decks/${deckId}/share`).set(...auth(stranger)).send({}).expect(404);
    await request(server).delete(`/api/decks/${deckId}/share`).set(...auth(stranger)).expect(404);
  });

  it('answers 404 once the owner is soft-deleted, and for malformed or unknown tokens', async () => {
    const owner = await createSession('softdelete');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId);
    await request(server).get(`/api/shared/decks/${token}`).expect(200);

    await dataSource.query(`UPDATE "user" SET "deletedAt" = now() WHERE id = $1`, [owner.userId]);

    const dead = await request(server).get(`/api/shared/decks/${token}`).expect(404);
    expect(dead.body.code).toBe('SHARE_LINK_UNAVAILABLE');
    expect(dead.headers['x-robots-tag']).toBe('noindex, nofollow');
    await request(server).get('/api/shared/decks/not-a-token').expect(404);
    await request(server).get('/api/shared/decks/AAAAAAAAAAAAAAAAAAAAAA').expect(404);
  });

  it('returns the enriched deck, hides what is private and marks noindex', async () => {
    const owner = await createSession('view');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId);
    await request(server).patch('/api/users/me/contact').set(...auth(owner)).send({ whatsappNumber: '(51) 99999-0000' }).expect(200);
    await ownCopies(owner, CARD_A.cardIdentifier, 1);

    const res = await request(server).get(`/api/shared/decks/${token}`).expect(200);

    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.body).toMatchObject({
      token,
      url: `http://localhost:5173/d/${token}`,
      name: 'Shared test deck',
      sharerName: 'Rodrigo',
      contactWhatsapp: '5551999990000',
      isOwner: false,
      deckId: null,
      totalCards: 4,
      missingCount: 3,
    });
    expect(res.body.cards).toHaveLength(2);
    expect(res.body.missing.map((card: { quantity: number }) => card.quantity).sort()).toEqual([1, 2]);
    expect(JSON.stringify(res.body)).not.toContain(owner.userId);

    await request(server).patch(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ showContact: false }).expect(200);
    const hidden = await request(server).get(`/api/shared/decks/${token}`).expect(200);
    expect(hidden.body.contactWhatsapp).toBeNull();
  });

  it('records opens for visitors but not for the owner, and gives the deck id only to the owner', async () => {
    const owner = await createSession('opens');
    const visitor = await createSession('opens-visitor');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId);

    const ownerView = await request(server).get(`/api/shared/decks/${token}`).set(...auth(owner)).expect(200);
    expect(ownerView.body).toMatchObject({ isOwner: true, deckId });
    expect(await countEvents('opened', owner.userId)).toBe(0);

    await request(server).get(`/api/shared/decks/${token}`).set(...auth(visitor)).expect(200);
    await request(server).get(`/api/shared/decks/${token}`).expect(200);
    await request(server).get(`/api/shared/decks/${token}`).set('Authorization', 'Bearer garbage').expect(200);
    expect(await countEvents('opened', owner.userId)).toBe(3);

    const actors = (await dataSource.query(
      `SELECT "actorUserId" FROM share_event WHERE kind = 'opened' AND "ownerUserId" = $1 ORDER BY id`,
      [owner.userId],
    )) as { actorUserId: string | null }[];
    expect(actors.map((row) => row.actorUserId)).toEqual([visitor.userId, null, null]);
  });

  it('reports coverage from the visitor collection and requires login', async () => {
    const owner = await createSession('coverage');
    const visitor = await createSession('coverage-visitor');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId);

    await request(server).get(`/api/shared/decks/${token}/coverage`).expect(401);
    const empty = await request(server).get(`/api/shared/decks/${token}/coverage`).set(...auth(visitor)).expect(200);
    expect(empty.body).toEqual({ ownedCopies: 0, totalCopies: 4, percent: 0 });

    await ownCopies(visitor, CARD_A.cardIdentifier, 2);

    const partial = await request(server).get(`/api/shared/decks/${token}/coverage`).set(...auth(visitor)).expect(200);
    expect(partial.body).toEqual({ ownedCopies: 2, totalCopies: 4, percent: 50 });

    await request(server).delete(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(204);
    const dead = await request(server).get(`/api/shared/decks/${token}/coverage`).set(...auth(visitor)).expect(404);
    expect(dead.body.code).toBe('SHARE_LINK_UNAVAILABLE');
  });

  it('copies the deck to the visitor as an unshared idea deck', async () => {
    const owner = await createSession('copy');
    const visitor = await createSession('copy-visitor');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId);

    await request(server).post(`/api/shared/decks/${token}/copy`).send({}).expect(401);
    const res = await request(server).post(`/api/shared/decks/${token}/copy`).set(...auth(visitor)).send({}).expect(201);

    const copy = await request(server).get(`/api/decks/${res.body.deckId}`).set(...auth(visitor)).expect(200);
    expect(copy.body).toMatchObject({ name: 'Shared test deck', status: 'idea', totalCards: 4 });
    const [row] = (await dataSource.query(`SELECT "shareToken", "fabraryUlid" FROM tracked_deck WHERE id = $1`, [res.body.deckId])) as {
      shareToken: string | null;
      fabraryUlid: string | null;
    }[];
    expect(row).toEqual({ shareToken: null, fabraryUlid: null });

    await request(server).delete(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(204);
    await request(server).post(`/api/shared/decks/${token}/copy`).set(...auth(visitor)).send({}).expect(404);
  });

  describe('sign-up attribution', () => {
    const normalize = (body: { message: string; _devVerificationLink: string }) => ({
      message: body.message,
      link: body._devVerificationLink.replace(/token=.*/, 'token=X'),
    });

    it('attributes a new user to a live link, ignores a dead one, and answers identically', async () => {
      const owner = await createSession('referral-owner');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId);

      const plain = await signUpRaw(emailFor('plain')).expect(202);
      const viaLive = await signUpRaw(emailFor('via-live'), token).expect(202);
      const viaDead = await signUpRaw(emailFor('via-dead'), 'AAAAAAAAAAAAAAAAAAAAAA').expect(202);
      const viaJunk = await signUpRaw(emailFor('via-junk'), '../../etc').expect(202);

      expect(normalize(viaLive.body)).toEqual(normalize(plain.body));
      expect(normalize(viaDead.body)).toEqual(normalize(plain.body));
      expect(normalize(viaJunk.body)).toEqual(normalize(plain.body));

      const referred = (await dataSource.query(
        `SELECT email, "referredByUserId", "referredVia" FROM "user" WHERE email = ANY($1)`,
        [[emailFor('plain'), emailFor('via-live'), emailFor('via-dead'), emailFor('via-junk')]],
      )) as { email: string; referredByUserId: string | null; referredVia: string | null }[];
      const byEmail = new Map(referred.map((row) => [row.email, row]));
      expect(byEmail.get(emailFor('via-live'))).toMatchObject({ referredByUserId: owner.userId, referredVia: 'deck' });
      for (const label of ['plain', 'via-dead', 'via-junk']) {
        expect(byEmail.get(emailFor(label))).toMatchObject({ referredByUserId: null, referredVia: null });
      }
      expect(await countEvents('signed_up', owner.userId)).toBe(1);
    });

    it('records nothing when the email already exists', async () => {
      const owner = await createSession('referral-existing-owner');
      const existing = await createSession('referral-existing');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId);

      await signUpRaw(emailFor('referral-existing'), token).expect(202);

      expect(await countEvents('signed_up', owner.userId)).toBe(0);
      const [row] = (await dataSource.query(`SELECT "referredByUserId" FROM "user" WHERE id = $1`, [existing.userId])) as {
        referredByUserId: string | null;
      }[];
      expect(row?.referredByUserId).toBeNull();
    });
  });

  it('exposes the sharing profile on /auth/me and validates profile updates', async () => {
    const user = await createSession('profile');

    const before = await request(server).get('/api/auth/me').set(...auth(user)).expect(200);
    expect(before.body).toMatchObject({ displayName: null, whatsappNumber: null });

    await request(server).patch('/api/users/me/display-name').set(...auth(user)).send({ displayName: 'x' }).expect(400);
    const saved = await request(server).patch('/api/users/me/display-name').set(...auth(user)).send({ displayName: '  Rodrigo  ' }).expect(200);
    expect(saved.body).toEqual({ displayName: 'Rodrigo' });

    await request(server).patch('/api/users/me/contact').set(...auth(user)).send({ whatsappNumber: '123' }).expect(400);
    await request(server).patch('/api/users/me/contact').set(...auth(user)).send({}).expect(400);
    const contact = await request(server).patch('/api/users/me/contact').set(...auth(user)).send({ whatsappNumber: '51 3333-4444' }).expect(200);
    expect(contact.body).toEqual({ whatsappNumber: '555133334444' });

    const after = await request(server).get('/api/auth/me').set(...auth(user)).expect(200);
    expect(after.body).toMatchObject({ displayName: 'Rodrigo', whatsappNumber: '555133334444' });

    const cleared = await request(server).patch('/api/users/me/contact').set(...auth(user)).send({ whatsappNumber: null }).expect(200);
    expect(cleared.body).toEqual({ whatsappNumber: null });
  });
});

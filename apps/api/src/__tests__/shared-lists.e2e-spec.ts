/**
 * Shared lists E2E: owner share routes, the public shared list, matches against the visitor's
 * collection and decks, the /l/:token page, the preview image, list delete and sign-up referral.
 * Needs a real Postgres (DATABASE_URL) with NODE_ENV=development so TypeORM synchronizes the schema.
 * Card faces are stubbed (no network in CI) and the SPA index.html is a fixture.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { AppModule } from '../app.module';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { configureHttpApp } from '../http/configure-http-app';
import { SPA_INDEX_HTML } from '../sharing/preview/spa-index-html';
import { DELETE_SHARE_LINKS_FOR_USERS_SQL } from '../sharing/preview/share-link-cleanup';
import { sessionCookieHeader, sessionTokenOf } from '../auth/__tests__/session-test-helpers';

const PASSWORD = 'shared-lists-test-password-123';
const SUFFIX = Date.now().toString(36);
const emailFor = (label: string): string => `shared-lists-e2e-${label}-${SUFFIX}@test.local`;

const SPA_FIXTURE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Rathe Arsenal</title><meta name="description" content="spa default">
<noscript>needs js</noscript><script type="module" src="/assets/index.js"></script></head>
<body><div id="root"></div></body></html>`;

const [CARD_A, CARD_B, CARD_C] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero' && card.imageUrl)
  .slice(0, 3) as [ICatalogCard, ICatalogCard, ICatalogCard];

interface ISession {
  readonly userId: string;
  readonly sessionToken: string;
}

describe('Shared lists (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: ReturnType<INestApplication['getHttpServer']>;
  const fetchStub = {
    guardedFetch: jest.fn<Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>, [string]>(),
  };

  const auth = (session: ISession): [string, string] => ['Cookie', sessionCookieHeader(session.sessionToken)];

  function signUpRaw(email: string, shareToken?: string): request.Test {
    return request(server)
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD, ...(shareToken ? { shareToken } : {}) });
  }

  async function createSession(label: string): Promise<ISession> {
    const signUp = await signUpRaw(emailFor(label)).expect(201);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    return { userId: signUp.body.user.id as string, sessionToken: sessionTokenOf(signUp) };
  }

  async function createList(
    session: ISession,
    kind: 'want' | 'sell',
    name = 'Lista <b>"A"</b>',
  ): Promise<number> {
    const res = await request(server).post('/api/lists').set(...auth(session)).send({ kind, name }).expect(201);
    return res.body.id as number;
  }

  async function addLine(
    session: ISession,
    listId: number,
    card: ICatalogCard,
    quantity: number,
    extra: Record<string, unknown> = {},
  ): Promise<number> {
    const res = await request(server)
      .post(`/api/lists/${listId}/lines`)
      .set(...auth(session))
      .send({ cardIdentifier: card.cardIdentifier, quantity, ...extra });
    expect([200, 201]).toContain(res.status);
    const lines = res.body.lines as { id: number; cardIdentifier: string }[];
    return lines.find((line) => line.cardIdentifier === card.cardIdentifier)!.id;
  }

  async function startSharing(session: ISession, listId: number): Promise<string> {
    await request(server).patch('/api/users/me/display-name').set(...auth(session)).send({ displayName: 'Rodrigo' }).expect(200);
    const res = await request(server).post(`/api/lists/${listId}/share`).set(...auth(session)).send({}).expect(201);
    return res.body.token as string;
  }

  async function ownCopies(session: ISession, card: ICatalogCard, quantity: number): Promise<void> {
    const [source] = (await dataSource.query(
      `INSERT INTO csv_source ("userId", kind, active) VALUES ($1, 'manual', true) RETURNING id`,
      [session.userId],
    )) as [{ id: string }];
    await dataSource.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", quantity, "sourceId") VALUES ($1, $2, $3, $4)`,
      [session.userId, card.cardIdentifier, quantity, source.id],
    );
  }

  async function createDeck(session: ISession, status: string, card: ICatalogCard, quantity: number): Promise<number> {
    const [deck] = (await dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Visitor deck', 'Some Hero', NULL, 'cc', $2) RETURNING id`,
      [session.userId, status],
    )) as [{ id: number }];
    await dataSource.query(
      `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, slot) VALUES ($1, $2, $3, 'mainboard')`,
      [deck.id, card.cardIdentifier, quantity],
    );
    return deck.id;
  }

  async function countEvents(kind: string, ownerUserId: string): Promise<number> {
    const rows = (await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM share_event WHERE kind = $1 AND "ownerUserId" = $2 AND "targetKind" = 'list'`,
      [kind, ownerUserId],
    )) as { n: number }[];
    return rows[0]?.n ?? 0;
  }

  const imageHash = async (token: string): Promise<string | undefined> => {
    const rows = (await dataSource.query(
      `SELECT i."contentHash" FROM share_image i JOIN share_link l ON l.id = i."shareLinkId" WHERE l.token = $1`,
      [token],
    )) as { contentHash: string }[];
    return rows[0]?.contentHash;
  };

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

    const faceBody = await sharp({ create: { width: 450, height: 630, channels: 3, background: '#7a5a2a' } })
      .webp()
      .toBuffer();
    fetchStub.guardedFetch.mockImplementation(async () => ({ status: 200, headers: {}, body: faceBody }));

    const indexPath = join(await mkdtemp(join(tmpdir(), 'shared-lists-e2e-')), 'index.html');
    await writeFile(indexPath, SPA_FIXTURE);

    // The guard is an APP_GUARD, which overrideProvider cannot reach.
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FetchGuardService)
      .useValue(fetchStub)
      .overrideProvider(SPA_INDEX_HTML)
      .useValue(indexPath)
      .compile();

    app = configureHttpApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email LIKE $1`, [`shared-lists-e2e-%-${SUFFIX}@test.local`]);
    }
    await app?.close();
  });

  describe('owner share routes', () => {
    it('turns a link on, on again, off and on again, and the old address dies', async () => {
      const owner = await createSession('lifecycle');
      const listId = await createList(owner, 'want');

      const off = await request(server).get(`/api/lists/${listId}/share`).set(...auth(owner)).expect(200);
      expect(off.headers['content-type']).toMatch(/json/);
      expect(off.body).toBeNull();
      await request(server).patch(`/api/lists/${listId}/share`).set(...auth(owner)).send({ showContact: false }).expect(404);
      const blocked = await request(server).post(`/api/lists/${listId}/share`).set(...auth(owner)).send({}).expect(409);
      expect(blocked.body.code).toBe('DISPLAY_NAME_REQUIRED');

      const first = await startSharing(owner, listId);
      const again = await request(server).post(`/api/lists/${listId}/share`).set(...auth(owner)).send({}).expect(201);
      expect(again.body).toEqual({ intent: 'want', url: `http://localhost:5173/l/${first}`, token: first, showContact: true });
      expect(await countEvents('created', owner.userId)).toBe(1);

      const state = await request(server).get(`/api/lists/${listId}/share`).set(...auth(owner)).expect(200);
      expect(state.body).toEqual(again.body);
      await request(server).get(`/api/shared/lists/${first}`).expect(200);

      await request(server).delete(`/api/lists/${listId}/share`).set(...auth(owner)).expect(204);
      const dead = await request(server).get(`/api/shared/lists/${first}`).expect(404);
      expect(dead.body.code).toBe('SHARE_LINK_UNAVAILABLE');
      expect((await request(server).get(`/api/lists/${listId}/share`).set(...auth(owner)).expect(200)).body).toBeNull();

      const second = await request(server).post(`/api/lists/${listId}/share`).set(...auth(owner)).send({}).expect(201);
      expect(second.body.token).not.toBe(first);
      await request(server).get(`/api/shared/lists/${first}`).expect(404);
      await request(server).get(`/api/shared/lists/${second.body.token}`).expect(200);
      expect(await countEvents('created', owner.userId)).toBe(2);
    });

    it('uses the list kind as the link intent', async () => {
      const owner = await createSession('intent');
      const sellId = await createList(owner, 'sell');
      await startSharing(owner, sellId);

      const state = await request(server).get(`/api/lists/${sellId}/share`).set(...auth(owner)).expect(200);

      expect(state.body.intent).toBe('sell');
    });

    it('keeps every share route to the list owner', async () => {
      const owner = await createSession('owner-only');
      const stranger = await createSession('owner-only-stranger');
      const listId = await createList(owner, 'sell');
      const token = await startSharing(owner, listId);
      await request(server).patch('/api/users/me/display-name').set(...auth(stranger)).send({ displayName: 'Intruso' }).expect(200);

      for (const call of [
        request(server).get(`/api/lists/${listId}/share`),
        request(server).post(`/api/lists/${listId}/share`).send({}),
        request(server).patch(`/api/lists/${listId}/share`).send({ showContact: false }),
        request(server).delete(`/api/lists/${listId}/share`),
      ]) {
        const res = await call.set(...auth(stranger)).expect(404);
        expect(res.body.code).toBe('CARD_LIST_NOT_FOUND');
      }
      await request(server).get(`/api/lists/${listId}/share`).expect(401);
      await request(server).get(`/api/shared/lists/${token}`).expect(200);
    });

    it('switches the contact number on the page with the link switch', async () => {
      const owner = await createSession('contact');
      const listId = await createList(owner, 'want');
      await request(server).patch('/api/users/me/contact').set(...auth(owner)).send({ whatsappNumber: '(51) 99999-0000' }).expect(200);
      const token = await startSharing(owner, listId);

      const shown = await request(server).get(`/api/shared/lists/${token}`).expect(200);
      expect(shown.body.contactWhatsapp).toBeTruthy();

      const patched = await request(server)
        .patch(`/api/lists/${listId}/share`)
        .set(...auth(owner))
        .send({ showContact: false })
        .expect(200);
      expect(patched.body).toMatchObject({ token, showContact: false });
      const hidden = await request(server).get(`/api/shared/lists/${token}`).expect(200);
      expect(hidden.body.contactWhatsapp).toBeNull();
      await request(server).patch(`/api/lists/${listId}/share`).set(...auth(owner)).send({}).expect(400);
    });

    it('marks the list as shared in the summaries and clears it when the link goes off', async () => {
      const owner = await createSession('summary');
      const listId = await createList(owner, 'want');
      const otherId = await createList(owner, 'sell', 'Other');
      await startSharing(owner, listId);

      const on = await request(server).get('/api/lists').set(...auth(owner)).expect(200);
      expect(on.body.find((list: { id: number }) => list.id === listId).shared).toBe(true);
      expect(on.body.find((list: { id: number }) => list.id === otherId).shared).toBe(false);

      await request(server).delete(`/api/lists/${listId}/share`).set(...auth(owner)).expect(204);
      const off = await request(server).get('/api/lists').set(...auth(owner)).expect(200);
      expect(off.body.find((list: { id: number }) => list.id === listId).shared).toBe(false);
    });
  });

  describe('GET /api/shared/lists/:token', () => {
    it('shows every line, sold included, the total on sell lists and no private data', async () => {
      const owner = await createSession('page');
      const listId = await createList(owner, 'sell', 'Sobras');
      await request(server).patch(`/api/lists/${listId}`).set(...auth(owner)).send({ totalPriceCents: 42000, notes: 'Retiro em POA' }).expect(200);
      const soldLine = await addLine(owner, listId, CARD_A, 1, { condition: 'NM', priceCents: 600 });
      await addLine(owner, listId, CARD_B, 2);
      await request(server).patch(`/api/lists/${listId}/lines/${soldLine}`).set(...auth(owner)).send({ sold: true }).expect(200);
      const token = await startSharing(owner, listId);

      const res = await request(server).get(`/api/shared/lists/${token}`).expect(200);

      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.body).toMatchObject({
        kind: 'sell',
        token,
        url: `http://localhost:5173/l/${token}`,
        name: 'Sobras',
        notes: 'Retiro em POA',
        sharerName: 'Rodrigo',
        isOwner: false,
        listId: null,
        totalPriceCents: 42000,
      });
      expect(res.body.lines.map((line: { cardIdentifier: string; sold: boolean }) => [line.cardIdentifier, line.sold])).toEqual([
        [CARD_A.cardIdentifier, true],
        [CARD_B.cardIdentifier, false],
      ]);
      expect(res.body.lines[0]).toMatchObject({ condition: 'NM', priceCents: 600, name: CARD_A.name });
      expect(JSON.stringify(res.body)).not.toContain(owner.userId);
    });

    it('answers a want list without a total', async () => {
      const owner = await createSession('want-page');
      const listId = await createList(owner, 'want');
      await addLine(owner, listId, CARD_A, 3);
      const token = await startSharing(owner, listId);

      const res = await request(server).get(`/api/shared/lists/${token}`).expect(200);

      expect(res.body).toMatchObject({ kind: 'want', totalPriceCents: null });
      expect(res.body.lines).toHaveLength(1);
    });

    it('records opens for anonymous and signed-in visitors but never for the owner, and gives the list id only to the owner', async () => {
      const owner = await createSession('opens');
      const visitor = await createSession('opens-visitor');
      const listId = await createList(owner, 'want');
      const token = await startSharing(owner, listId);

      await request(server).get(`/api/shared/lists/${token}`).expect(200);
      await request(server).get(`/api/shared/lists/${token}`).set(...auth(visitor)).expect(200);
      const asOwner = await request(server).get(`/api/shared/lists/${token}`).set(...auth(owner)).expect(200);

      expect(asOwner.body).toMatchObject({ isOwner: true, listId });
      expect(await countEvents('opened', owner.userId)).toBe(2);
      const [event] = (await dataSource.query(
        `SELECT intent, "actorUserId" FROM share_event WHERE kind = 'opened' AND "ownerUserId" = $1 AND "actorUserId" IS NOT NULL`,
        [owner.userId],
      )) as { intent: string; actorUserId: string }[];
      expect(event).toEqual({ intent: 'want', actorUserId: visitor.userId });
    });

    it('answers 404 for malformed, unknown and deck tokens and once the owner is soft-deleted', async () => {
      const owner = await createSession('dead');
      const listId = await createList(owner, 'want');
      const token = await startSharing(owner, listId);
      const [deck] = (await dataSource.query(
        `INSERT INTO tracked_deck ("userId", name, hero, format, status) VALUES ($1, 'D', 'H', 'cc', 'building') RETURNING id`,
        [owner.userId],
      )) as [{ id: number }];
      const deckLink = await request(server).post(`/api/decks/${deck.id}/share`).set(...auth(owner)).send({ intent: 'deck' }).expect(201);

      for (const dead of ['x', 'A'.repeat(22), deckLink.body.token]) {
        const res = await request(server).get(`/api/shared/lists/${dead}`).expect(404);
        expect(res.body.code).toBe('SHARE_LINK_UNAVAILABLE');
      }
      await request(server).get(`/api/shared/decks/${token}`).expect(404);

      await dataSource.query(`UPDATE "user" SET "deletedAt" = now() WHERE id = $1`, [owner.userId]);
      await request(server).get(`/api/shared/lists/${token}`).expect(404);
    });
  });

  describe('GET /api/shared/lists/:token/matches', () => {
    it('on a want list gives what the visitor owns, line by line', async () => {
      const owner = await createSession('match-want');
      const visitor = await createSession('match-want-visitor');
      const listId = await createList(owner, 'want');
      const lineA = await addLine(owner, listId, CARD_A, 3);
      const lineB = await addLine(owner, listId, CARD_B, 1);
      const token = await startSharing(owner, listId);
      await ownCopies(visitor, CARD_A, 2);
      await createDeck(visitor, 'building', CARD_B, 4);

      await request(server).get(`/api/shared/lists/${token}/matches`).expect(401);
      const res = await request(server).get(`/api/shared/lists/${token}/matches`).set(...auth(visitor)).expect(200);

      expect(res.body.lines).toEqual([
        { lineId: lineA, owned: 2, missingInDecks: 0 },
        { lineId: lineB, owned: 0, missingInDecks: 0 },
      ]);
    });

    it('on a sell list adds the copies missing in non-retired decks, for available lines only', async () => {
      const owner = await createSession('match-sell');
      const visitor = await createSession('match-sell-visitor');
      const listId = await createList(owner, 'sell');
      const lineA = await addLine(owner, listId, CARD_A, 2);
      const lineB = await addLine(owner, listId, CARD_B, 1);
      const lineC = await addLine(owner, listId, CARD_C, 1);
      await request(server).patch(`/api/lists/${listId}/lines/${lineC}`).set(...auth(owner)).send({ sold: true }).expect(200);
      const token = await startSharing(owner, listId);

      await ownCopies(visitor, CARD_A, 1);
      await createDeck(visitor, 'building', CARD_A, 3);
      await createDeck(visitor, 'active', CARD_A, 2);
      await createDeck(visitor, 'retired', CARD_B, 4);
      await createDeck(visitor, 'building', CARD_C, 2);

      const res = await request(server).get(`/api/shared/lists/${token}/matches`).set(...auth(visitor)).expect(200);

      // Deck 1 needs 3 of A and owns 1 (2 missing); deck 2 needs 2 and owns 1 (1 missing).
      expect(res.body.lines).toEqual([
        { lineId: lineA, owned: 1, missingInDecks: 3 },
        { lineId: lineB, owned: 0, missingInDecks: 0 },
        { lineId: lineC, owned: 0, missingInDecks: 0 },
      ]);
    });

    it('gives the owner no lines, and answers 404 for a dead link', async () => {
      const owner = await createSession('match-owner');
      const listId = await createList(owner, 'sell');
      await addLine(owner, listId, CARD_A, 1);
      const token = await startSharing(owner, listId);

      const own = await request(server).get(`/api/shared/lists/${token}/matches`).set(...auth(owner)).expect(200);
      expect(own.body).toEqual({ lines: [] });

      await request(server).delete(`/api/lists/${listId}/share`).set(...auth(owner)).expect(204);
      const dead = await request(server).get(`/api/shared/lists/${token}/matches`).set(...auth(owner)).expect(404);
      expect(dead.body.code).toBe('SHARE_LINK_UNAVAILABLE');
    });
  });

  describe('GET /l/:token', () => {
    it('puts the share tags before any script or noscript, escaped, with noindex', async () => {
      const owner = await createSession('html');
      const listId = await createList(owner, 'want', 'Para o <Calling> "X"');
      await addLine(owner, listId, CARD_A, 3);
      await addLine(owner, listId, CARD_B, 2);
      const token = await startSharing(owner, listId);

      const res = await request(server).get(`/l/${token}`).expect(200);

      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.text).toContain('<div id="root">');
      expect(res.text).toContain('og:title" content="Procuro: Para o &lt;Calling&gt; &quot;X&quot;"');
      const image = res.text.match(/og:image" content="([^"]+)"/)?.[1];
      expect(image).toMatch(new RegExp(`^http://localhost:5173/api/shared/lists/${token}/image\\?v=[\\w-]{10}$`));

      const withVersion = await request(server).get(`/l/${token}?v=abc123`).expect(200);
      expect(withVersion.text).toContain('og:title" content="Procuro: Para o &lt;Calling&gt; &quot;X&quot;"');

      await addLine(owner, listId, CARD_A, 1);
      const changed = await request(server).get(`/l/${token}`).expect(200);
      expect(changed.text.match(/og:image" content="([^"]+)"/)?.[1]).not.toBe(image);
      expect(res.text).toContain(`og:url" content="http://localhost:5173/l/${token}"`);
      expect(res.text).toContain('Rodrigo procura 5 cartas:');
      expect(res.text).toContain('name="robots" content="noindex,nofollow"');
      expect(res.text).not.toContain('spa default');
      const head = res.text.slice(0, res.text.indexOf('</head>'));
      const firstOgTitle = head.indexOf('og:title');
      expect(firstOgTitle).toBeGreaterThan(0);
      expect(firstOgTitle).toBeLessThan(head.search(/<script|<noscript/));
    });

    it('describes a sell list with prices and the total, and leaves sold lines out', async () => {
      const owner = await createSession('html-sell');
      const listId = await createList(owner, 'sell', 'Sobras');
      await request(server).patch(`/api/lists/${listId}`).set(...auth(owner)).send({ totalPriceCents: 42000 }).expect(200);
      await addLine(owner, listId, CARD_A, 1, { priceCents: 12000 });
      const sold = await addLine(owner, listId, CARD_B, 4);
      await request(server).patch(`/api/lists/${listId}/lines/${sold}`).set(...auth(owner)).send({ sold: true }).expect(200);
      const token = await startSharing(owner, listId);

      const res = await request(server).get(`/l/${token}`).expect(200);

      expect(res.text).toContain('og:title" content="Vendo: Sobras"');
      expect(res.text).toContain(`Rodrigo vende 1 carta: 1x ${CARD_A.name} (R$ 120). Tudo por R$ 420,00`);
      expect(res.text).not.toContain(CARD_B.name);
    });

    it('answers a dead, unknown or deck address with the generic tags', async () => {
      const owner = await createSession('html-dead');
      const listId = await createList(owner, 'want');
      const token = await startSharing(owner, listId);
      await request(server).delete(`/api/lists/${listId}/share`).set(...auth(owner)).expect(204);

      for (const dead of [token, 'A'.repeat(22), 'x']) {
        const res = await request(server).get(`/l/${dead}`).expect(200);
        expect(res.text).toContain('og:title" content="Rathe Arsenal"');
        expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      }
    });
  });

  describe('GET /api/shared/lists/:token/image', () => {
    it('serves a stored jpeg, a download name, and renders again only when what is drawn changes', async () => {
      const owner = await createSession('image');
      const listId = await createList(owner, 'sell', 'Sobras do Calling');
      const lineA = await addLine(owner, listId, CARD_A, 2);
      const token = await startSharing(owner, listId);

      const res = await request(server).get(`/api/shared/lists/${token}/image`).buffer(true).parse(binary).expect(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect((await sharp(res.body as Buffer).metadata()).format).toBe('jpeg');
      const first = await imageHash(token);
      expect(first).toBeDefined();

      const download = await request(server).get(`/api/shared/lists/${token}/image?download=1`).buffer(true).parse(binary).expect(200);
      expect(download.headers['content-disposition']).toBe('attachment; filename="sobras-do-calling.jpg"');
      expect(await imageHash(token)).toBe(first);

      const soldExtra = await addLine(owner, listId, CARD_B, 3);
      await request(server).patch(`/api/lists/${listId}/lines/${soldExtra}`).set(...auth(owner)).send({ sold: true }).expect(200);
      await request(server).get(`/api/shared/lists/${token}/image`).buffer(true).parse(binary).expect(200);
      expect(await imageHash(token)).toBe(first);

      await request(server).patch(`/api/lists/${listId}`).set(...auth(owner)).send({ totalPriceCents: 9900 }).expect(200);
      await request(server).get(`/api/shared/lists/${token}/image`).buffer(true).parse(binary).expect(200);
      const priced = await imageHash(token);
      expect(priced).not.toBe(first);

      await request(server).patch(`/api/lists/${listId}/lines/${lineA}`).set(...auth(owner)).send({ sold: true }).expect(200);
      await request(server).get(`/api/shared/lists/${token}/image`).buffer(true).parse(binary).expect(200);
      expect(await imageHash(token)).not.toBe(priced);
    });

    it('serves a generic jpeg for a dead link and never counts an open', async () => {
      const owner = await createSession('image-dead');
      const listId = await createList(owner, 'want');
      const token = await startSharing(owner, listId);
      await request(server).get(`/api/shared/lists/${token}/image`).expect(200);
      await request(server).delete(`/api/lists/${listId}/share`).set(...auth(owner)).expect(204);

      const res = await request(server).get(`/api/shared/lists/${token}/image`).buffer(true).parse(binary).expect(200);

      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(await countEvents('opened', owner.userId)).toBe(0);
    });
  });

  describe('deleting', () => {
    it('removes the share link and its stored image with the list', async () => {
      const owner = await createSession('delete');
      const listId = await createList(owner, 'want');
      await addLine(owner, listId, CARD_A, 1);
      const token = await startSharing(owner, listId);
      await request(server).get(`/api/shared/lists/${token}/image`).expect(200);
      expect(await imageHash(token)).toBeDefined();

      await request(server).delete(`/api/lists/${listId}`).set(...auth(owner)).expect(204);

      await request(server).get(`/api/shared/lists/${token}`).expect(404);
      expect(await dataSource.query(`SELECT 1 FROM share_link WHERE "targetKind" = 'list' AND "targetId" = $1`, [listId])).toHaveLength(0);
      expect(await imageHash(token)).toBeUndefined();
    });

    it('leaves the links of another owner untouched when a list is refused', async () => {
      const owner = await createSession('delete-refused');
      const stranger = await createSession('delete-refused-stranger');
      const listId = await createList(owner, 'want');
      const token = await startSharing(owner, listId);

      await request(server).delete(`/api/lists/${listId}`).set(...auth(stranger)).expect(404);

      await request(server).get(`/api/shared/lists/${token}`).expect(200);
    });

    it('is covered by the delete-account link cleanup', async () => {
      const owner = await createSession('account');
      const listId = await createList(owner, 'sell');
      const token = await startSharing(owner, listId);

      await dataSource.query(DELETE_SHARE_LINKS_FOR_USERS_SQL, [[owner.userId]]);

      await request(server).get(`/api/shared/lists/${token}`).expect(404);
    });
  });

  describe('sign-up from a list link', () => {
    it.each<['want' | 'sell']>([['want'], ['sell']])('stores %s as the channel and records signed_up with the intent', async (kind) => {
      const owner = await createSession(`referral-${kind}`);
      const listId = await createList(owner, kind);
      const token = await startSharing(owner, listId);

      await signUpRaw(emailFor(`via-${kind}`), token).expect(201);

      const [row] = (await dataSource.query(
        `SELECT "referredByUserId", "referredVia" FROM "user" WHERE email = $1`,
        [emailFor(`via-${kind}`)],
      )) as { referredByUserId: string | null; referredVia: string | null }[];
      expect(row).toEqual({ referredByUserId: owner.userId, referredVia: kind });
      const [event] = (await dataSource.query(
        `SELECT intent, "targetKind", "targetId" FROM share_event WHERE kind = 'signed_up' AND "ownerUserId" = $1`,
        [owner.userId],
      )) as { intent: string; targetKind: string; targetId: number }[];
      expect(event).toEqual({ intent: kind, targetKind: 'list', targetId: listId });
    });

    it('ignores a dead list link and answers the same', async () => {
      const owner = await createSession('referral-dead');
      const listId = await createList(owner, 'want');
      const token = await startSharing(owner, listId);
      await request(server).delete(`/api/lists/${listId}/share`).set(...auth(owner)).expect(204);

      const dead = await signUpRaw(emailFor('via-dead'), token).expect(201);
      const plain = await signUpRaw(emailFor('via-none')).expect(201);

      expect(Object.keys(dead.body).sort()).toEqual(Object.keys(plain.body).sort());
      const [row] = (await dataSource.query(`SELECT "referredByUserId" FROM "user" WHERE email = $1`, [emailFor('via-dead')])) as {
        referredByUserId: string | null;
      }[];
      expect(row?.referredByUserId).toBeNull();
    });
  });
});

function binary(res: request.Response, callback: (error: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

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
import { sessionCookieHeader, sessionTokenOf } from '../auth/__tests__/session-test-helpers';
import { DECK_SHARE_INTENTS } from '../database/entities/share-link.entity';

const PASSWORD = 'sharing-test-password-123';
const SUFFIX = Date.now().toString(36);
const emailFor = (label: string): string => `share-e2e-${label}-${SUFFIX}@test.local`;

const [CARD_A, CARD_B] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero')
  .slice(0, 2) as [ICatalogCard, ICatalogCard];

interface ISession {
  readonly userId: string;
  readonly sessionToken: string;
}

describe('Sharing (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const auth = (session: ISession): [string, string] => ['Cookie', sessionCookieHeader(session.sessionToken)];

  function signUpRaw(email: string, shareToken?: string): request.Test {
    return request(server)
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD, ...(shareToken ? { shareToken } : {}) });
  }

  async function createSession(label: string): Promise<ISession> {
    const email = emailFor(label);
    const signUp = await signUpRaw(email).expect(201);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    return { userId: signUp.body.user.id as string, sessionToken: sessionTokenOf(signUp) };
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

  async function startSharing(session: ISession, deckId: number, intent: 'deck' | 'missing' | 'quote' = 'deck'): Promise<string> {
    await request(server).patch('/api/users/me/display-name').set(...auth(session)).send({ displayName: 'Rodrigo' }).expect(200);
    const res = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(session)).send({ intent }).expect(201);
    return res.body.token as string;
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
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

  it('turns a link on, on again, off and on again, and the old link dies', async () => {
    const owner = await createSession('lifecycle');
    const deckId = await createDeck(owner);

    const blocked = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'deck' }).expect(409);
    expect(blocked.body.code).toBe('DISPLAY_NAME_REQUIRED');
    await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({}).expect(400);
    await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'want' }).expect(400);

    const first = await startSharing(owner, deckId);
    const again = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'deck' }).expect(201);
    expect(again.body).toEqual({ intent: 'deck', url: `http://localhost:5173/d/${first}`, token: first, showContact: true });
    expect(await countEvents('created', owner.userId)).toBe(1);

    const state = await request(server).get(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(200);
    expect(state.body).toEqual({ deck: again.body, missing: null });
    await request(server).get(`/api/shared/decks/${first}`).expect(200);

    await request(server).delete(`/api/decks/${deckId}/share/deck`).set(...auth(owner)).expect(204);
    await request(server).get(`/api/shared/decks/${first}`).expect(404);
    const off = await request(server).get(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(200);
    expect(off.body).toEqual({ deck: null, missing: null });

    const second = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'deck' }).expect(201);
    expect(second.body.token).not.toBe(first);
    await request(server).get(`/api/shared/decks/${first}`).expect(404);
    await request(server).get(`/api/shared/decks/${second.body.token}`).expect(200);
    expect(await countEvents('created', owner.userId)).toBe(2);
  });

  it('gives each intent of one deck its own address, page and contact switch', async () => {
    const owner = await createSession('intents');
    const deckId = await createDeck(owner);
    const deckToken = await startSharing(owner, deckId, 'deck');
    const missingToken = await startSharing(owner, deckId, 'missing');
    await request(server).patch('/api/users/me/contact').set(...auth(owner)).send({ whatsappNumber: '(51) 99999-0000' }).expect(200);

    expect(missingToken).not.toBe(deckToken);
    const state = await request(server).get(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(200);
    expect(state.body.deck).toMatchObject({ intent: 'deck', token: deckToken });
    expect(state.body.missing).toMatchObject({ intent: 'missing', token: missingToken });

    await request(server).patch(`/api/decks/${deckId}/share/missing`).set(...auth(owner)).send({ showContact: false }).expect(200);
    const deckPage = await request(server).get(`/api/shared/decks/${deckToken}`).expect(200);
    const missingPage = await request(server).get(`/api/shared/decks/${missingToken}`).expect(200);
    expect(deckPage.body.contactWhatsapp).toBe('5551999990000');
    expect(missingPage.body.contactWhatsapp).toBeNull();

    await request(server).delete(`/api/decks/${deckId}/share/missing`).set(...auth(owner)).expect(204);
    await request(server).get(`/api/shared/decks/${missingToken}`).expect(404);
    await request(server).get(`/api/shared/decks/${deckToken}`).expect(200);
    await request(server).patch(`/api/decks/${deckId}/share/missing`).set(...auth(owner)).send({ showContact: true }).expect(404);
    await request(server).delete(`/api/decks/${deckId}/share/nonsense`).set(...auth(owner)).expect(400);
  });

  it('never puts the missing cards in the deck page nor the deck cards in the missing page', async () => {
    const owner = await createSession('separation');
    const deckId = await createDeck(owner);
    const deckToken = await startSharing(owner, deckId, 'deck');
    const missingToken = await startSharing(owner, deckId, 'missing');
    await ownCopies(owner, CARD_A.cardIdentifier, 1);

    const deckPage = await request(server).get(`/api/shared/decks/${deckToken}`).expect(200);
    expect(deckPage.body).toMatchObject({ intent: 'deck', missing: [], missingCount: 0, totalCards: 4 });
    expect(deckPage.body.cards).toHaveLength(2);

    const missingPage = await request(server).get(`/api/shared/decks/${missingToken}`).expect(200);
    expect(missingPage.body).toMatchObject({ intent: 'missing', cards: [], missingCount: 3, totalCards: 4 });
    expect(missingPage.body.missing.map((card: { quantity: number }) => card.quantity).sort()).toEqual([1, 2]);
  });

  it('answers coverage and copy only for the deck intent', async () => {
    const owner = await createSession('deck-only');
    const visitor = await createSession('deck-only-visitor');
    const deckId = await createDeck(owner);
    const missingToken = await startSharing(owner, deckId, 'missing');

    const coverage = await request(server).get(`/api/shared/decks/${missingToken}/coverage`).set(...auth(visitor)).expect(404);
    expect(coverage.body.code).toBe('SHARE_LINK_UNAVAILABLE');
    await request(server).post(`/api/shared/decks/${missingToken}/copy`).set(...auth(visitor)).send({}).expect(404);

    // An unknown token, a malformed one and a switched-off one answer 404 the same way, and none of them writes a deck.
    const deckToken = await startSharing(owner, deckId, 'deck');
    await request(server).delete(`/api/decks/${deckId}/share/deck`).set(...auth(owner)).expect(204);
    for (const token of ['mQ8rZ3nUp2bX5yKdFgHjLs', 'nope', deckToken]) {
      const refused = await request(server).post(`/api/shared/decks/${token}/copy`).set(...auth(visitor)).send({ variant: 'original' }).expect(404);
      expect(refused.body.code).toBe('SHARE_LINK_UNAVAILABLE');
    }
    const decks = (await dataSource.query(`SELECT COUNT(*)::int AS n FROM tracked_deck WHERE "userId" = $1`, [visitor.userId])) as { n: number }[];
    expect(decks[0]!.n).toBe(0);
  });

  it('answers matches only for the missing intent, with what the visitor owns of each missing card', async () => {
    const owner = await createSession('matches');
    const visitor = await createSession('matches-visitor');
    const deckId = await createDeck(owner);
    const deckToken = await startSharing(owner, deckId, 'deck');
    const missingToken = await startSharing(owner, deckId, 'missing');

    await request(server).get(`/api/shared/decks/${missingToken}/matches`).expect(401);
    const deckMatches = await request(server).get(`/api/shared/decks/${deckToken}/matches`).set(...auth(visitor)).expect(404);
    expect(deckMatches.body.code).toBe('SHARE_LINK_UNAVAILABLE');

    const none = await request(server).get(`/api/shared/decks/${missingToken}/matches`).set(...auth(visitor)).expect(200);
    expect(none.body.cards).toEqual(
      expect.arrayContaining([
        { cardIdentifier: CARD_A.cardIdentifier, owned: 0 },
        { cardIdentifier: CARD_B.cardIdentifier, owned: 0 },
      ]),
    );

    await ownCopies(visitor, CARD_A.cardIdentifier, 2);
    const some = await request(server).get(`/api/shared/decks/${missingToken}/matches`).set(...auth(visitor)).expect(200);
    expect(some.body.cards).toHaveLength(2);
    expect(some.body.cards).toEqual(
      expect.arrayContaining([
        { cardIdentifier: CARD_A.cardIdentifier, owned: 2 },
        { cardIdentifier: CARD_B.cardIdentifier, owned: 0 },
      ]),
    );
  });

  it('share creation answers 201, 400 and 404 by intent and owner', async () => {
    const owner = await createSession('creation-statuses');
    const stranger = await createSession('creation-stranger');
    const deckId = await createDeck(owner);
    const listId = (await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: 'Wants' }).expect(201)).body.id as number;
    await request(server).patch('/api/users/me/display-name').set(...auth(owner)).send({ displayName: 'Rodrigo' }).expect(200);

    for (const intent of DECK_SHARE_INTENTS) {
      await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent }).expect(201);
    }
    await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'bogus' }).expect(400);
    await request(server).post(`/api/lists/${listId}/share`).set(...auth(owner)).send({ intent: 'quote' }).expect(400);
    await request(server).post(`/api/lists/${listId}/share`).set(...auth(owner)).send({}).expect(201);
    await request(server).post(`/api/decks/${deckId}/share`).set(...auth(stranger)).send({ intent: 'deck' }).expect(404);
    await request(server).post(`/api/lists/${listId}/share`).set(...auth(stranger)).send({}).expect(404);
  });

  describe('store states on the missing page', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const STORE_CARDS = [CARD_A.cardIdentifier, CARD_B.cardIdentifier];
    const passAt = new Date(Date.now() - DAY_MS);
    let storeId: number;
    let createdStore = false;
    let savedPassAt: Date | null = null;
    let savedActive = true;
    let savedStock: Array<Record<string, unknown>> = [];

    beforeAll(async () => {
      const existing: Array<{ id: number; lastAvailabilityPassAt: Date | null; active: boolean }> = await dataSource.query(
        `SELECT id, "lastAvailabilityPassAt", active FROM store WHERE slug = 'cupula-dt'`,
      );
      if (existing.length === 0) {
        const created: Array<{ id: number }> = await dataSource.query(
          `INSERT INTO store (slug, name, "baseUrl", "listingPath", "rateLimitMs", active)
           VALUES ('cupula-dt', 'Cúpula DT', 'https://www.cupuladt.com.br', '/?view=ecom/itens&tcg=8', 1500, true) RETURNING id`,
        );
        storeId = created[0]!.id;
        createdStore = true;
      } else {
        storeId = existing[0]!.id;
        savedPassAt = existing[0]!.lastAvailabilityPassAt;
        savedActive = existing[0]!.active;
      }
      savedStock = await dataSource.query(`SELECT * FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, STORE_CARDS]);
      await dataSource.query(`UPDATE store SET "lastAvailabilityPassAt" = $2, active = true WHERE id = $1`, [storeId, passAt]);
    });

    afterAll(async () => {
      await dataSource.query(`DELETE FROM variant_fetch_job WHERE "cardIdentifier" = ANY($1)`, [STORE_CARDS]);
      await dataSource.query(`DELETE FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, STORE_CARDS]);
      for (const row of savedStock) {
        await dataSource.query(
          `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt", "listedInStockAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [storeId, row['cardIdentifier'], row['priceCents'], row['quantity'], row['productUrl'], row['productNameRaw'], row['lastFetchedAt'], row['listedInStockAt']],
        );
      }
      if (createdStore) await dataSource.query(`DELETE FROM store WHERE id = $1`, [storeId]);
      else await dataSource.query(`UPDATE store SET "lastAvailabilityPassAt" = $2, active = $3 WHERE id = $1`, [storeId, savedPassAt, savedActive]);
    });

    beforeEach(async () => {
      await dataSource.query(`DELETE FROM variant_fetch_job WHERE "cardIdentifier" = ANY($1)`, [STORE_CARDS]);
      await dataSource.query(`DELETE FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, STORE_CARDS]);
    });

    async function listCard(cardIdentifier: string, priceCents: number, quantity: number, fetchedDaysAgo: number): Promise<void> {
      await dataSource.query(
        `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt", "listedInStockAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [storeId, cardIdentifier, priceCents, quantity, `https://www.cupuladt.com.br/?view=ecom/item&id=${cardIdentifier}`, cardIdentifier, new Date(Date.now() - fetchedDaysAgo * DAY_MS), passAt],
      );
    }

    async function jobCount(): Promise<number> {
      const [row] = (await dataSource.query(`SELECT count(*)::int AS n FROM variant_fetch_job`)) as [{ n: number }];
      return row.n;
    }

    it('the missing page carries the stored store states and the store summary', async () => {
      const owner = await createSession('store-states');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId, 'missing');
      await listCard(CARD_A.cardIdentifier, 3000, 2, 3);

      const page = await request(server).get(`/api/shared/decks/${token}`).expect(200);

      const byCard = new Map((page.body.missing as Array<{ cardIdentifier: string }>).map((card) => [card.cardIdentifier, card]));
      expect(byCard.get(CARD_A.cardIdentifier)).toMatchObject({
        quantity: 3,
        state: 'priced',
        unitPriceCents: 3000,
        lineCents: 6000,
        availableCopies: 2,
        foilOnly: false,
        promoOnly: false,
        productUrl: `https://www.cupuladt.com.br/?view=ecom/item&id=${CARD_A.cardIdentifier}`,
      });
      expect(byCard.get(CARD_B.cardIdentifier)).toMatchObject({
        quantity: 1,
        state: 'not_on_site',
        unitPriceCents: null,
        lineCents: null,
        availableCopies: null,
        productUrl: null,
      });
      expect(page.body.storeSummary).toEqual({ copies: 2, cents: 6000 });
      expect(page.body.missingCount).toBe(4);
    });

    it('the missing page gives a signed-in visitor owned and spare per card', async () => {
      const owner = await createSession('visitor-counts-owner');
      const visitor = await createSession('visitor-counts');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId, 'missing');
      await ownCopies(visitor, CARD_A.cardIdentifier, 2);

      const asVisitor = await request(server).get(`/api/shared/decks/${token}`).set(...auth(visitor)).expect(200);
      const anonymous = await request(server).get(`/api/shared/decks/${token}`).expect(200);

      const owned = (body: { missing: Array<{ cardIdentifier: string; owned: number | null }> }) =>
        Object.fromEntries(body.missing.map((card) => [card.cardIdentifier, card.owned]));
      expect(owned(asVisitor.body)).toEqual({ [CARD_A.cardIdentifier]: 2, [CARD_B.cardIdentifier]: 0 });
      expect(owned(anonymous.body)).toEqual({ [CARD_A.cardIdentifier]: null, [CARD_B.cardIdentifier]: null });

      const spare = (body: { missing: Array<{ cardIdentifier: string; spare: number | null }> }) =>
        Object.fromEntries(body.missing.map((card) => [card.cardIdentifier, card.spare]));
      // The visitor has no deck yet: both copies are spare, and no question is owed.
      expect(spare(asVisitor.body)).toEqual({ [CARD_A.cardIdentifier]: 2, [CARD_B.cardIdentifier]: 0 });
      expect(asVisitor.body.spareNeedsRule).toBe(false);
      expect(spare(anonymous.body)).toEqual({ [CARD_A.cardIdentifier]: null, [CARD_B.cardIdentifier]: null });
      expect(anonymous.body.spareNeedsRule).toBe(false);

      // A deck of the visitor that uses 3 of the 2 copies owned leaves none spare.
      await createDeck(visitor);
      const withDeck = await request(server).get(`/api/shared/decks/${token}`).set(...auth(visitor)).expect(200);
      expect(owned(withDeck.body)).toEqual({ [CARD_A.cardIdentifier]: 2, [CARD_B.cardIdentifier]: 0 });
      expect(spare(withDeck.body)).toEqual({ [CARD_A.cardIdentifier]: 0, [CARD_B.cardIdentifier]: 0 });
      expect(withDeck.body.spareNeedsRule).toBe(false);

      // Two holding decks that use the same card: the visitor owes the rule question, and no spare is given before it.
      await createDeck(visitor);
      const asked = await request(server).get(`/api/shared/decks/${token}`).set(...auth(visitor)).expect(200);
      expect(asked.body.spareNeedsRule).toBe(true);
      expect(spare(asked.body)).toEqual({ [CARD_A.cardIdentifier]: null, [CARD_B.cardIdentifier]: null });
      expect(owned(asked.body)).toEqual({ [CARD_A.cardIdentifier]: 2, [CARD_B.cardIdentifier]: 0 });

      await request(server).put('/api/users/me/spare-rule').set(...auth(visitor)).send({ rule: 'any_deck' }).expect(200);
      const answered = await request(server).get(`/api/shared/decks/${token}`).set(...auth(visitor)).expect(200);
      expect(answered.body.spareNeedsRule).toBe(false);
      expect(spare(answered.body)[CARD_A.cardIdentifier]).toBe(0);
    });

    it("the owner's own missing page carries no visitor counts", async () => {
      const owner = await createSession('own-page');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId, 'missing');
      await ownCopies(owner, CARD_A.cardIdentifier, 1);

      const page = await request(server).get(`/api/shared/decks/${token}`).set(...auth(owner)).expect(200);

      expect(page.body.isOwner).toBe(true);
      expect(page.body.missing.map((card: { owned: number | null }) => card.owned)).toEqual([null, null]);
      expect(page.body.missing.map((card: { spare: number | null }) => card.spare)).toEqual([null, null]);
      expect(page.body.spareNeedsRule).toBe(false);
    });

    it('a public page reads the stored store states and queues no lookup', async () => {
      const owner = await createSession('no-queue');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId, 'missing');
      const quoteToken = await startSharing(owner, deckId, 'quote');
      await listCard(CARD_A.cardIdentifier, 3000, 2, 40);
      const before = await jobCount();

      const page = await request(server).get(`/api/shared/decks/${token}`).expect(200);
      const quote = await request(server).get(`/api/shared/decks/${quoteToken}`).expect(200);

      const stale = page.body.missing.find((card: { cardIdentifier: string }) => card.cardIdentifier === CARD_A.cardIdentifier);
      expect(stale.state).toBe('looking_up');
      expect(quote.body.needed).toHaveLength(2);
      expect(await jobCount()).toBe(before);
    });

    it('the quote page carries the needed cards and nothing about stores', async () => {
      const owner = await createSession('quote-page');
      const deckId = await createDeck(owner);
      await request(server).patch('/api/users/me/contact').set(...auth(owner)).send({ whatsappNumber: '(51) 99999-0000' }).expect(200);
      const token = await startSharing(owner, deckId, 'quote');
      await listCard(CARD_A.cardIdentifier, 3000, 2, 3);
      await ownCopies(owner, CARD_A.cardIdentifier, 1);

      const page = await request(server).get(`/api/shared/decks/${token}`).expect(200);

      expect(Object.keys(page.body).sort()).toEqual(['contactWhatsapp', 'hero', 'intent', 'name', 'needed', 'sharerName']);
      expect(page.body).toMatchObject({ intent: 'quote', name: 'Shared test deck', hero: 'Some Hero', sharerName: 'Rodrigo', contactWhatsapp: '5551999990000' });
      expect(page.body.needed).toHaveLength(2);
      for (const item of page.body.needed as Array<Record<string, unknown>>) {
        expect(Object.keys(item).sort()).toEqual(['cardIdentifier', 'imageUrl', 'name', 'pitch', 'quantity']);
      }
      const byCard = new Map((page.body.needed as Array<{ cardIdentifier: string; quantity: number }>).map((item) => [item.cardIdentifier, item.quantity]));
      expect(byCard.get(CARD_A.cardIdentifier)).toBe(2);
      expect(byCard.get(CARD_B.cardIdentifier)).toBe(1);
      const body = JSON.stringify(page.body);
      expect(body).not.toMatch(/C[uú]pula|cupuladt|unitPriceCents|productUrl|storeSummary|lineCents/);
    });
  });

  it('creates or reuses one quote address per deck', async () => {
    const owner = await createSession('quote-address');
    const deckId = await createDeck(owner);
    await request(server).patch('/api/users/me/display-name').set(...auth(owner)).send({ displayName: 'Rodrigo' }).expect(200);

    const first = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'quote' }).expect(201);
    const second = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'quote' }).expect(201);

    expect(first.body).toEqual({ intent: 'quote', url: `http://localhost:5173/d/${first.body.token}`, token: first.body.token, showContact: true });
    expect(second.body.token).toBe(first.body.token);
    expect(await countEvents('created', owner.userId)).toBe(1);
    const rows = (await dataSource.query(
      `SELECT intent FROM share_link WHERE "targetKind" = 'deck' AND "targetId" = $1`,
      [deckId],
    )) as { intent: string }[];
    expect(rows).toEqual([{ intent: 'quote' }]);
    const state = await request(server).get(`/api/decks/${deckId}/share`).set(...auth(owner)).expect(200);
    expect(state.body).toEqual({ deck: null, missing: null });
  });

  it('a quote address answers nothing but the quote', async () => {
    const owner = await createSession('quote-only');
    const visitor = await createSession('quote-only-visitor');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId, 'quote');

    for (const [method, path] of [
      ['get', 'coverage'],
      ['get', 'matches'],
      ['post', 'copy'],
    ] as const) {
      const refused = await request(server)[method](`/api/shared/decks/${token}/${path}`).set(...auth(visitor)).send({});
      expect([method, path, refused.status, refused.body.code]).toEqual([method, path, 404, 'SHARE_LINK_UNAVAILABLE']);
    }
    await request(server).get(`/api/shared/decks/${token}`).expect(200);

    await request(server).delete(`/api/decks/${deckId}/share/quote`).set(...auth(owner)).expect(204);
    const off = await request(server).get(`/api/shared/decks/${token}`).expect(404);
    expect(off.body.code).toBe('SHARE_LINK_UNAVAILABLE');

    const second = await request(server).post(`/api/decks/${deckId}/share`).set(...auth(owner)).send({ intent: 'quote' }).expect(201);
    await request(server).delete(`/api/decks/${deckId}`).set(...auth(owner)).expect(200);
    const gone = await request(server).get(`/api/shared/decks/${second.body.token}`).expect(404);
    expect(gone.body.code).toBe('SHARE_LINK_UNAVAILABLE');
    const unknown = await request(server).get(`/api/shared/decks/${'a'.repeat(32)}`).expect(404);
    expect(unknown.body.code).toBe('SHARE_LINK_UNAVAILABLE');
  });

  it('keeps sharing controls to the deck owner', async () => {
    const owner = await createSession('ownership');
    const stranger = await createSession('stranger');
    const deckId = await createDeck(owner);

    await request(server).post(`/api/decks/${deckId}/share`).set(...auth(stranger)).send({ intent: 'deck' }).expect(404);
    await request(server).delete(`/api/decks/${deckId}/share/deck`).set(...auth(stranger)).expect(404);
  });

  it('turning off the missing link answers 204, kills only that link and is repeatable', async () => {
    const owner = await createSession('turn-off-missing');
    const stranger = await createSession('turn-off-stranger');
    const deckId = await createDeck(owner);
    const deckToken = await startSharing(owner, deckId, 'deck');
    const missingToken = await startSharing(owner, deckId, 'missing');
    const quoteToken = await startSharing(owner, deckId, 'quote');
    await request(server).get(`/api/shared/decks/${missingToken}`).expect(200);

    await request(server).delete(`/api/decks/${deckId}/share/missing`).set(...auth(stranger)).expect(404);
    await request(server).get(`/api/shared/decks/${missingToken}`).expect(200);
    await request(server).delete(`/api/decks/${deckId}/share/missing`).expect(401);

    await request(server).delete(`/api/decks/${deckId}/share/missing`).set(...auth(owner)).expect(204);
    await request(server).get(`/api/shared/decks/${missingToken}`).expect(404);
    await request(server).delete(`/api/decks/${deckId}/share/missing`).set(...auth(owner)).expect(204);

    await request(server).get(`/api/shared/decks/${deckToken}`).expect(200);
    await request(server).get(`/api/shared/decks/${quoteToken}`).expect(200);
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

  it("a deleted deck's links answer 404 until it is restored", async () => {
    const owner = await createSession('deckdelete');
    const deckId = await createDeck(owner);
    const deckToken = await startSharing(owner, deckId, 'deck');
    const missingToken = await startSharing(owner, deckId, 'missing');
    await request(server).get(`/api/shared/decks/${deckToken}`).expect(200);
    await request(server).get(`/api/shared/decks/${missingToken}`).expect(200);

    await request(server).delete(`/api/decks/${deckId}`).set(...auth(owner)).expect(200);

    for (const token of [deckToken, missingToken]) {
      const dead = await request(server).get(`/api/shared/decks/${token}`).expect(404);
      expect(dead.body.code).toBe('SHARE_LINK_UNAVAILABLE');
    }

    await request(server).post(`/api/decks/${deckId}/restore`).set(...auth(owner)).expect(200);

    await request(server).get(`/api/shared/decks/${deckToken}`).expect(200);
    await request(server).get(`/api/shared/decks/${missingToken}`).expect(200);
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
      intent: 'deck',
      token,
      url: `http://localhost:5173/d/${token}`,
      name: 'Shared test deck',
      sharerName: 'Rodrigo',
      contactWhatsapp: '5551999990000',
      isOwner: false,
      deckId: null,
      totalCards: 4,
    });
    expect(res.body.cards).toHaveLength(2);
    expect(res.body.cards[0]).toMatchObject({ cardIdentifier: CARD_A.cardIdentifier, quantity: 3, inventoryQuantity: 0 });
    expect(JSON.stringify(res.body)).not.toContain(owner.userId);

    await request(server).patch(`/api/decks/${deckId}/share/deck`).set(...auth(owner)).send({ showContact: false }).expect(200);
    const hidden = await request(server).get(`/api/shared/decks/${token}`).expect(200);
    expect(hidden.body.contactWhatsapp).toBeNull();
  });

  it("the deck intent carries each line's inventory", async () => {
    const owner = await createSession('inventory');
    const deckId = await createDeck(owner);
    await dataSource.query(`UPDATE deck_card SET "inventoryQuantity" = 2 WHERE "trackedDeckId" = $1 AND "cardIdentifier" = $2`, [
      deckId,
      CARD_B.cardIdentifier,
    ]);
    await dataSource.query(
      `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, "inventoryQuantity", slot) VALUES ($1, 'snatch-red', 0, 3, 'mainboard')`,
      [deckId],
    );
    const token = await startSharing(owner, deckId);

    const res = await request(server).get(`/api/shared/decks/${token}`).expect(200);

    const lines = (res.body.cards as Array<{ cardIdentifier: string; quantity: number; inventoryQuantity: number }>).map(
      ({ cardIdentifier, quantity, inventoryQuantity }) => ({ cardIdentifier, quantity, inventoryQuantity }),
    );
    expect(lines).toEqual([
      { cardIdentifier: CARD_A.cardIdentifier, quantity: 3, inventoryQuantity: 0 },
      { cardIdentifier: CARD_B.cardIdentifier, quantity: 1, inventoryQuantity: 2 },
      { cardIdentifier: 'snatch-red', quantity: 0, inventoryQuantity: 3 },
    ]);
    expect(res.body.totalCards).toBe(4);
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
    await request(server).get(`/api/shared/decks/${token}`).set('Cookie', 'ra_session=garbage').expect(200);
    expect(await countEvents('opened', owner.userId)).toBe(3);

    const actors = (await dataSource.query(
      `SELECT "actorUserId" FROM share_event WHERE kind = 'opened' AND "ownerUserId" = $1 ORDER BY id`,
      [owner.userId],
    )) as { actorUserId: string | null }[];
    expect(actors.map((row) => row.actorUserId)).toEqual([visitor.userId, null, null]);
    const intents = (await dataSource.query(
      `SELECT DISTINCT intent FROM share_event WHERE "ownerUserId" = $1`,
      [owner.userId],
    )) as { intent: string }[];
    expect(intents).toEqual([{ intent: 'deck' }]);
  });

  it('reports coverage from the visitor collection and requires login', async () => {
    const owner = await createSession('coverage');
    const visitor = await createSession('coverage-visitor');
    const deckId = await createDeck(owner);
    const token = await startSharing(owner, deckId);

    await request(server).get(`/api/shared/decks/${token}/coverage`).expect(401);
    const empty = await request(server).get(`/api/shared/decks/${token}/coverage`).set(...auth(visitor)).expect(200);
    expect(empty.body).toEqual({ ownedCopies: 0, totalCopies: 4, percent: 0, collectionEmpty: true });

    await ownCopies(visitor, CARD_A.cardIdentifier, 2);

    const partial = await request(server).get(`/api/shared/decks/${token}/coverage`).set(...auth(visitor)).expect(200);
    expect(partial.body).toEqual({ ownedCopies: 2, totalCopies: 4, percent: 50, collectionEmpty: false });

    await request(server).delete(`/api/decks/${deckId}/share/deck`).set(...auth(owner)).expect(204);
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
    const [row] = (await dataSource.query(`SELECT "fabraryUlid" FROM tracked_deck WHERE id = $1`, [res.body.deckId])) as {
      fabraryUlid: string | null;
    }[];
    expect(row).toEqual({ fabraryUlid: null });
    expect(await dataSource.query(`SELECT 1 FROM share_link WHERE "targetId" = $1`, [res.body.deckId])).toHaveLength(0);

    await request(server).delete(`/api/decks/${deckId}/share/deck`).set(...auth(owner)).expect(204);
    await request(server).post(`/api/shared/decks/${token}/copy`).set(...auth(visitor)).send({}).expect(404);
  });

  it('copy asks for a variant when the deck has active replacements', async () => {
    const owner = await createSession('variant');
    const visitor = await createSession('variant-visitor');
    const deckId = await createDeck(owner);
    // The owner swapped their single copy of B for A: the list before the pick held A 3, B 1 plus one A more.
    await dataSource.query(
      `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, side, "pickedFrom", status)
       VALUES ($1, $2, 'mainboard', $3, $4, 1, 'deck', 'search', 'active')`,
      [owner.userId, deckId, CARD_A.cardIdentifier, CARD_B.cardIdentifier],
    );
    const token = await startSharing(owner, deckId);
    const copy = (body: Record<string, unknown>): request.Test =>
      request(server).post(`/api/shared/decks/${token}/copy`).set(...auth(visitor)).send(body);
    const decksOf = async (): Promise<number> =>
      ((await dataSource.query(`SELECT COUNT(*)::int AS n FROM tracked_deck WHERE "userId" = $1`, [visitor.userId])) as { n: number }[])[0]!.n;
    const cardsOf = async (id: number): Promise<Record<string, number>> => {
      const res = await request(server).get(`/api/decks/${id}`).set(...auth(visitor)).expect(200);
      return Object.fromEntries((res.body.cards as { cardIdentifier: string; quantity: number }[]).map((card) => [card.cardIdentifier, card.quantity]));
    };

    const missing = await copy({}).expect(400);
    expect(missing.body.code).toBe('COPY_VARIANT_REQUIRED');
    await copy({ variant: 'other' }).expect(400);
    expect(await decksOf()).toBe(0);

    const original = await copy({ variant: 'original' }).expect(201);
    expect(await cardsOf(original.body.deckId as number)).toEqual({ [CARD_A.cardIdentifier]: 4 });
    const built = await copy({ variant: 'as_built' }).expect(201);
    expect(await cardsOf(built.body.deckId as number)).toEqual({ [CARD_A.cardIdentifier]: 3, [CARD_B.cardIdentifier]: 1 });
    expect(await decksOf()).toBe(2);

    await dataSource.query(`UPDATE card_replacement SET status = 'kept' WHERE "trackedDeckId" = $1`, [deckId]);
    await copy({}).expect(201);
  });

  it('offer, quote_sent and buy are recorded with intent and visitor, never for the owner', async () => {
    const owner = await createSession('visitor-events-owner');
    const visitor = await createSession('visitor-events-visitor');
    const deckId = await createDeck(owner);
    const quoteToken = await startSharing(owner, deckId, 'quote');
    const wantList = (await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: 'Procuro' }).expect(201)).body.id as number;
    const sellList = (await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'sell', name: 'Vendo' }).expect(201)).body.id as number;
    const wantToken = (await request(server).post(`/api/lists/${wantList}/share`).set(...auth(owner)).send({}).expect(201)).body.token as string;
    const sellToken = (await request(server).post(`/api/lists/${sellList}/share`).set(...auth(owner)).send({}).expect(201)).body.token as string;
    const cases = [
      { kind: 'offer', path: `/api/shared/lists/${wantToken}/events`, intent: 'want' },
      { kind: 'quote_sent', path: `/api/shared/decks/${quoteToken}/events`, intent: 'quote' },
      { kind: 'buy', path: `/api/shared/lists/${sellToken}/events`, intent: 'sell' },
    ] as const;
    const rowsOf = async (kind: string): Promise<unknown[]> =>
      dataSource.query(`SELECT intent, "actorUserId" FROM share_event WHERE kind = $1 AND "ownerUserId" = $2 ORDER BY id`, [kind, owner.userId]);

    for (const { kind, path, intent } of cases) {
      await request(server).post(path).set(...auth(visitor)).send({ kind }).expect(204);
      await request(server).post(path).send({ kind }).expect(204);
      await request(server).post(path).set(...auth(owner)).send({ kind }).expect(204);

      expect(await rowsOf(kind)).toEqual([
        { intent, actorUserId: visitor.userId },
        { intent, actorUserId: null },
      ]);
    }
  });

  it('a list takes only the visitor event its kind has, and nothing else', async () => {
    const owner = await createSession('list-events-owner');
    const wantList = (await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: 'Procuro' }).expect(201)).body.id as number;
    const wantToken = await (async () => {
      await request(server).patch('/api/users/me/display-name').set(...auth(owner)).send({ displayName: 'Rodrigo' }).expect(200);
      return (await request(server).post(`/api/lists/${wantList}/share`).set(...auth(owner)).send({}).expect(201)).body.token as string;
    })();
    const post = (body: object) => request(server).post(`/api/shared/lists/${wantToken}/events`).send(body);

    await post({ kind: 'buy' }).expect(400);
    await post({ kind: 'quote_sent' }).expect(400);
    await post({ kind: 'opened' }).expect(400);
    await post({ kind: 'offer', quantity: 2 }).expect(400);
    await request(server).post(`/api/shared/lists/${'a'.repeat(32)}/events`).send({ kind: 'offer' }).expect(404);
    expect(await countEvents('offer', owner.userId)).toBe(0);
    expect(await countEvents('buy', owner.userId)).toBe(0);
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

      const plain = await signUpRaw(emailFor('plain')).expect(201);
      const viaLive = await signUpRaw(emailFor('via-live'), token).expect(201);
      const viaDead = await signUpRaw(emailFor('via-dead'), 'AAAAAAAAAAAAAAAAAAAAAA').expect(201);
      const viaJunk = await signUpRaw(emailFor('via-junk'), '../../etc').expect(201);

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

    it('stores want as the channel for a sign-up from a missing-cards link', async () => {
      const owner = await createSession('referral-want-owner');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId, 'missing');

      await signUpRaw(emailFor('via-want'), token).expect(201);

      const [row] = (await dataSource.query(
        `SELECT "referredByUserId", "referredVia" FROM "user" WHERE email = $1`,
        [emailFor('via-want')],
      )) as { referredByUserId: string | null; referredVia: string | null }[];
      expect(row).toEqual({ referredByUserId: owner.userId, referredVia: 'want' });
      const [event] = (await dataSource.query(
        `SELECT intent FROM share_event WHERE kind = 'signed_up' AND "ownerUserId" = $1`,
        [owner.userId],
      )) as { intent: string }[];
      expect(event?.intent).toBe('missing');
    });

    it('stores quote as the channel for a sign-up from a quote link', async () => {
      const owner = await createSession('referral-quote-owner');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId, 'quote');

      await signUpRaw(emailFor('via-quote'), token).expect(201);

      const [row] = (await dataSource.query(
        `SELECT "referredByUserId", "referredVia" FROM "user" WHERE email = $1`,
        [emailFor('via-quote')],
      )) as { referredByUserId: string | null; referredVia: string | null }[];
      expect(row).toEqual({ referredByUserId: owner.userId, referredVia: 'quote' });
      expect(await countEvents('signed_up', owner.userId)).toBe(1);
    });

    it('records nothing when the email already exists', async () => {
      const owner = await createSession('referral-existing-owner');
      const existing = await createSession('referral-existing');
      const deckId = await createDeck(owner);
      const token = await startSharing(owner, deckId);

      await signUpRaw(emailFor('referral-existing'), token).expect(409);

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

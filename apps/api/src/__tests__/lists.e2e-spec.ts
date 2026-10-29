/**
 * Card lists E2E: list and line routes, merge rules, sell-only fields, from-deck creation,
 * owner-only 404s and delete cascades. Needs a real Postgres (DATABASE_URL) with NODE_ENV=development
 * so TypeORM synchronizes the schema, like the other e2e specs.
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
import { printingsOfCard, printingVersion } from '../lists/printing-key';
import { sessionCookieHeader, sessionTokenOf } from '../auth/__tests__/session-test-helpers';

const PASSWORD = 'lists-test-password-123';
const SUFFIX = Date.now().toString(36);
const emailFor = (label: string): string => `lists-e2e-${label}-${SUFFIX}@test.local`;

const [CARD_A, CARD_B, CARD_C] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero' && card.imageUrl)
  .slice(0, 3) as [ICatalogCard, ICatalogCard, ICatalogCard];

const PRINTINGS_A = printingsOfCard(CARD_A.cardIdentifier) ?? [];
const [PRINTING_A1] = PRINTINGS_A;
const VERSION_A1 = printingVersion(PRINTING_A1!);

interface ISession {
  readonly userId: string;
  readonly sessionToken: string;
}

describe('Card lists (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const auth = (session: ISession): [string, string] => ['Cookie', sessionCookieHeader(session.sessionToken)];

  async function createSession(label: string): Promise<ISession> {
    const signUp = await request(server)
      .post('/api/auth/sign-up')
      .send({ email: emailFor(label), password: PASSWORD })
      .expect(201);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    return { userId: signUp.body.user.id as string, sessionToken: sessionTokenOf(signUp) };
  }

  async function createList(session: ISession, kind: 'want' | 'sell', name = 'My list'): Promise<number> {
    const res = await request(server).post('/api/lists').set(...auth(session)).send({ kind, name }).expect(201);
    return res.body.id as number;
  }

  async function createDeck(session: ISession): Promise<number> {
    const [deck] = (await dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Lists test deck', 'Some Hero', NULL, 'cc', 'building') RETURNING id`,
      [session.userId],
    )) as [{ id: number }];
    await dataSource.query(
      `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, slot)
       VALUES ($1, $2, 2, 'mainboard'), ($1, $2, 1, 'sideboard'), ($1, $3, 1, 'mainboard')`,
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

  interface IHeldRow {
    readonly sourceId: string;
    readonly printingCode?: string;
    readonly edition?: string;
    readonly finish?: string;
    readonly condition?: string;
    readonly quantity: number;
  }

  async function createImport(session: ISession): Promise<string> {
    const [source] = (await dataSource.query(
      `INSERT INTO csv_source ("userId", kind, active, "cardCount") VALUES ($1, 'csv', true, 0) RETURNING id`,
      [session.userId],
    )) as [{ id: string }];
    return source.id;
  }

  async function hold(session: ISession, cardIdentifier: string, row: IHeldRow): Promise<void> {
    await dataSource.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", "printingCode", edition, finish, condition, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [session.userId, cardIdentifier, row.sourceId, row.printingCode ?? '', row.edition ?? '', row.finish ?? '', row.condition ?? '', row.quantity],
    );
    await dataSource.query(`UPDATE csv_source SET "cardCount" = "cardCount" + 1 WHERE id = $1`, [row.sourceId]);
  }

  async function heldQuantities(session: ISession, cardIdentifier: string): Promise<Record<string, number>> {
    const rows = (await dataSource.query(
      `SELECT "sourceId", "printingCode", edition, finish, condition, quantity FROM collection_card
       WHERE "userId" = $1 AND "cardIdentifier" = $2`,
      [session.userId, cardIdentifier],
    )) as { sourceId: string; printingCode: string; edition: string; finish: string; condition: string; quantity: number }[];
    return Object.fromEntries(rows.map((row) => [[row.sourceId.slice(0, 4), row.printingCode, row.edition, row.finish, row.condition].join('|'), row.quantity]));
  }

  const markSold = (session: ISession, listId: number, lineId: number, body: Record<string, unknown>): request.Test =>
    request(server).post(`/api/lists/${listId}/lines/${lineId}/sold`).set(...auth(session)).send(body);

  async function soldFixture(label: string, quantity: number): Promise<{ owner: ISession; listId: number; lineId: number }> {
    const owner = await createSession(label);
    const listId = await createList(owner, 'sell');
    const lineId = (
      await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity, ...VERSION_A1, condition: 'NM' }).expect(201)
    ).body.lines[0].id as number;
    return { owner, listId, lineId };
  }

  const addLine = (session: ISession, listId: number, body: Record<string, unknown>): request.Test =>
    request(server).post(`/api/lists/${listId}/lines`).set(...auth(session)).send(body);

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '3001';

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = configureHttpApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email LIKE $1`, [`lists-e2e-%-${SUFFIX}@test.local`]);
    }
    await app?.close();
    jest.clearAllMocks();
  });

  it('requires authentication', async () => {
    await request(server).get('/api/lists').expect(401);
  });

  it('creates lists, gives sell lists a 7x multiplier and validates the body', async () => {
    const owner = await createSession('create');
    const want = await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: '  Cards I miss  ' }).expect(201);
    expect(want.body).toMatchObject({ kind: 'want', name: 'Cards I miss', notes: null, totalPriceCents: null, priceMultiplier: null, lines: [] });
    const sell = await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'sell', name: 'For sale' }).expect(201);
    expect(sell.body.priceMultiplier).toBe(7);

    await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'trade', name: 'x' }).expect(400);
    await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: '' }).expect(400);
    await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: 'x'.repeat(81) }).expect(400);
    await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: 'x', extra: 1 }).expect(400);
  });

  it('summarises lists newest first with counts and preview images', async () => {
    const owner = await createSession('summary');
    const first = await createList(owner, 'sell', 'First');
    const second = await createList(owner, 'want', 'Second');
    await addLine(owner, first, { cardIdentifier: CARD_A.cardIdentifier, quantity: 3 }).expect(201);
    await addLine(owner, first, { cardIdentifier: CARD_B.cardIdentifier, quantity: 2 }).expect(201);
    const listed = await request(server).get(`/api/lists/${first}`).set(...auth(owner)).expect(200);
    await request(server)
      .patch(`/api/lists/${first}/lines/${listed.body.lines[0].id}`)
      .set(...auth(owner))
      .send({ sold: true })
      .expect(200);
    await request(server).patch(`/api/lists/${second}`).set(...auth(owner)).send({ name: 'Second, renamed' }).expect(200);

    const res = await request(server).get('/api/lists').set(...auth(owner)).expect(200);
    expect(res.body.map((list: { id: number }) => list.id)).toEqual([second, first]);
    const summary = res.body[1];
    expect(summary).toMatchObject({ lineCount: 2, copyCount: 5, soldCount: 3, shared: false, totalPriceCents: null });
    expect(summary.previewImages).toHaveLength(2);
    expect(summary.previewImages[0]).toEqual({
      small: CARD_A.imageUrl?.small,
      large: CARD_A.imageUrl?.large,
      sources: CARD_A.imageUrl?.sources,
    });
    expect(res.body[0]).toMatchObject({ lineCount: 0, copyCount: 0, soldCount: 0, previewImages: [] });
  });

  it('answers 404 CARD_LIST_NOT_FOUND to every route for another user, and for ids out of range', async () => {
    const owner = await createSession('owner404');
    const stranger = await createSession('stranger404');
    const listId = await createList(owner, 'sell');
    const line = (await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 }).expect(201)).body.lines[0];

    const attempts: request.Test[] = [
      request(server).get(`/api/lists/${listId}`).set(...auth(stranger)),
      request(server).patch(`/api/lists/${listId}`).set(...auth(stranger)).send({ name: 'mine now' }),
      request(server).delete(`/api/lists/${listId}`).set(...auth(stranger)),
      addLine(stranger, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 }),
      request(server).patch(`/api/lists/${listId}/lines/${line.id}`).set(...auth(stranger)).send({ quantity: 5 }),
      request(server).delete(`/api/lists/${listId}/lines/${line.id}`).set(...auth(stranger)),
      request(server).get(`/api/lists/${listId}/printings/${CARD_A.cardIdentifier}`).set(...auth(stranger)),
      request(server).get('/api/lists/99999999999').set(...auth(owner)),
    ];
    for (const attempt of attempts) {
      const res = await attempt;
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CARD_LIST_NOT_FOUND');
    }

    const untouched = await request(server).get(`/api/lists/${listId}`).set(...auth(owner)).expect(200);
    expect(untouched.body.name).toBe('My list');
    expect(untouched.body.lines).toHaveLength(1);

    const otherList = await createList(owner, 'sell', 'Other');
    const wrongList = await request(server).patch(`/api/lists/${otherList}/lines/${line.id}`).set(...auth(owner)).send({ quantity: 2 });
    expect(wrongList.status).toBe(404);
    expect(wrongList.body.code).toBe('CARD_LIST_NOT_FOUND');
  });

  it('merges want lines by card and caps the quantity at 20', async () => {
    const owner = await createSession('wantmerge');
    const listId = await createList(owner, 'want');
    const created = await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 12 }).expect(201);
    expect(created.body.lines).toHaveLength(1);
    expect(created.body.lines[0]).toMatchObject({
      cardIdentifier: CARD_A.cardIdentifier,
      name: CARD_A.name,
      quantity: 12,
      printingCode: '',
      edition: '',
      finish: '',
      printing: null,
      printingLabel: null,
      condition: null,
      priceCents: null,
      sold: false,
      suggestion: null,
    });
    const merged = await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 12 }).expect(200);
    expect(merged.body.lines).toHaveLength(1);
    expect(merged.body.lines[0].quantity).toBe(20);
    await addLine(owner, listId, { cardIdentifier: CARD_B.cardIdentifier, quantity: 1 }).expect(201);
  });

  it('merges sell lines by card, printing and condition with nulls equal, and never into a sold line', async () => {
    const owner = await createSession('sellmerge');
    const listId = await createList(owner, 'sell');
    const base = { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 };

    await addLine(owner, listId, base).expect(201);
    await addLine(owner, listId, base).expect(200);
    await addLine(owner, listId, { ...base, condition: 'NM' }).expect(201);
    await addLine(owner, listId, { ...base, condition: 'NM', priceCents: 600 }).expect(200);
    const withPrinting = await addLine(owner, listId, { ...base, ...VERSION_A1, condition: 'NM' }).expect(201);
    expect(withPrinting.body.lines).toHaveLength(3);
    expect(withPrinting.body.lines.map((line: { quantity: number }) => line.quantity)).toEqual([2, 2, 1]);
    expect(withPrinting.body.lines[1].priceCents).toBe(600);
    expect(withPrinting.body.lines[2].printingLabel).toBe(PRINTING_A1?.label);

    const soldId = withPrinting.body.lines[0].id as number;
    await request(server).patch(`/api/lists/${listId}/lines/${soldId}`).set(...auth(owner)).send({ sold: true }).expect(200);
    const afterSold = await addLine(owner, listId, base).expect(201);
    expect(afterSold.body.lines).toHaveLength(4);
  });

  it('sell lines take the version as four fields', async () => {
    const owner = await createSession('fourfields');
    const stranger = await createSession('fourfields-stranger');
    const listId = await createList(owner, 'sell');
    const base = { cardIdentifier: CARD_A.cardIdentifier, quantity: 2, condition: 'NM', priceCents: 4500 };

    const created = await addLine(owner, listId, { ...base, ...VERSION_A1 }).expect(201);
    expect(created.body.lines[0]).toMatchObject({ ...VERSION_A1, condition: 'NM', quantity: 2, priceCents: 4500 });

    // Two finishes of one card are two lines, and the same four fields merge.
    await addLine(owner, listId, { ...base, finish: 'none' }).expect(201);
    const merged = await addLine(owner, listId, { ...base, ...VERSION_A1 }).expect(200);
    expect(merged.body.lines).toHaveLength(2);
    expect(merged.body.lines[0].quantity).toBe(4);

    expect((await addLine(owner, listId, { ...base, finish: 'shiny' }).expect(400)).body).toBeDefined();
    await addLine(owner, listId, { ...base, edition: 'second' }).expect(400);
    await addLine(owner, listId, { ...base, printing: PRINTING_A1?.key }).expect(400);
    await addLine(stranger, listId, { ...base, ...VERSION_A1 }).expect(404);
  });

  it('rejects unknown cards, foreign printings and sell-only fields on want lists', async () => {
    const owner = await createSession('rejects');
    const want = await createList(owner, 'want');
    const sell = await createList(owner, 'sell');

    const unknownCard = await addLine(owner, sell, { cardIdentifier: 'no-such-card', quantity: 1 }).expect(400);
    expect(unknownCard.body.code).toBe('UNKNOWN_CARD');
    const foreign = await addLine(owner, sell, {
      cardIdentifier: CARD_A.cardIdentifier,
      quantity: 1,
      printingCode: 'NOPE999',
    }).expect(400);
    expect(foreign.body.code).toBe('UNKNOWN_PRINTING');

    for (const field of [VERSION_A1, { finish: 'none' }, { condition: 'NM' }, { priceCents: 100 }]) {
      const res = await addLine(owner, want, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1, ...field }).expect(400);
      expect(res.body.code).toBe('SELL_ONLY_FIELD');
    }
    const wantLine = (await addLine(owner, want, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 }).expect(201)).body.lines[0];
    const patchSell = await request(server)
      .patch(`/api/lists/${want}/lines/${wantLine.id}`)
      .set(...auth(owner))
      .send({ priceCents: 100 })
      .expect(400);
    expect(patchSell.body.code).toBe('SELL_ONLY_FIELD');
    await request(server).patch(`/api/lists/${want}/lines/${wantLine.id}`).set(...auth(owner)).send({ quantity: 4 }).expect(200);

    await addLine(owner, sell, { cardIdentifier: CARD_A.cardIdentifier, quantity: 0 }).expect(400);
    await addLine(owner, sell, { cardIdentifier: CARD_A.cardIdentifier, quantity: 21 }).expect(400);
    await addLine(owner, sell, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1, condition: 'MINT' }).expect(400);
    await addLine(owner, sell, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1, priceCents: -1 }).expect(400);
  });

  it('rejects sell-only list fields on a want list and applies them on a sell list', async () => {
    const owner = await createSession('listpatch');
    const want = await createList(owner, 'want');
    const sell = await createList(owner, 'sell');

    for (const body of [{ totalPriceCents: 100 }, { priceMultiplier: 5 }]) {
      const res = await request(server).patch(`/api/lists/${want}`).set(...auth(owner)).send(body).expect(400);
      expect(res.body.code).toBe('SELL_ONLY_FIELD');
    }
    await request(server).patch(`/api/lists/${want}`).set(...auth(owner)).send({ totalPriceCents: null }).expect(200);

    const patched = await request(server)
      .patch(`/api/lists/${sell}`)
      .set(...auth(owner))
      .send({ notes: 'Pick up in Porto Alegre', totalPriceCents: 42000, priceMultiplier: 6.5 })
      .expect(200);
    expect(patched.body).toMatchObject({ notes: 'Pick up in Porto Alegre', totalPriceCents: 42000, priceMultiplier: 6.5 });

    const cleared = await request(server)
      .patch(`/api/lists/${sell}`)
      .set(...auth(owner))
      .send({ notes: '', totalPriceCents: null, priceMultiplier: null })
      .expect(200);
    expect(cleared.body).toMatchObject({ notes: null, totalPriceCents: null, priceMultiplier: null });

    await request(server).patch(`/api/lists/${sell}`).set(...auth(owner)).send({ notes: 'x'.repeat(1001) }).expect(400);
    await request(server).patch(`/api/lists/${sell}`).set(...auth(owner)).send({ priceMultiplier: 51 }).expect(400);
    await request(server).patch(`/api/lists/${sell}`).set(...auth(owner)).send({ priceMultiplier: 0 }).expect(400);
    await request(server).patch(`/api/lists/${sell}`).set(...auth(owner)).send({ totalPriceCents: -5 }).expect(400);
    await request(server).patch(`/api/lists/${sell}`).set(...auth(owner)).send({ name: null }).expect(400);
  });

  it('updates, marks sold, unmarks and removes a line, returning the whole list each time', async () => {
    const owner = await createSession('lineedit');
    const listId = await createList(owner, 'sell');
    const lineId = (await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 }).expect(201)).body.lines[0].id as number;
    const url = `/api/lists/${listId}/lines/${lineId}`;

    const edited = await request(server)
      .patch(url)
      .set(...auth(owner))
      .send({ quantity: 4, ...VERSION_A1, condition: 'LP', priceCents: 1400 })
      .expect(200);
    expect(edited.body.lines[0]).toMatchObject({ quantity: 4, ...VERSION_A1, printing: PRINTING_A1?.key, condition: 'LP', priceCents: 1400, sold: false });

    const sold = await request(server).patch(url).set(...auth(owner)).send({ sold: true }).expect(200);
    expect(sold.body.lines[0].sold).toBe(true);
    const back = await request(server).patch(url).set(...auth(owner)).send({ sold: false }).expect(200);
    expect(back.body.lines[0].sold).toBe(false);

    const cleared = await request(server).patch(url).set(...auth(owner)).send({ printingCode: '', edition: '', finish: '', condition: null, priceCents: null }).expect(200);
    expect(cleared.body.lines[0]).toMatchObject({ printingCode: '', edition: '', finish: '', printing: null, printingLabel: null, condition: null, priceCents: null });

    const foreign = await request(server).patch(url).set(...auth(owner)).send({ printingCode: 'NOPE999' }).expect(400);
    expect(foreign.body.code).toBe('UNKNOWN_PRINTING');

    const removed = await request(server).delete(url).set(...auth(owner)).expect(200);
    expect(removed.body.lines).toEqual([]);
    await request(server).delete(url).set(...auth(owner)).expect(404);
  });

  it('bumps updatedAt on every write', async () => {
    const owner = await createSession('updatedat');
    const listId = await createList(owner, 'sell');
    const before = (await request(server).get(`/api/lists/${listId}`).set(...auth(owner)).expect(200)).body.updatedAt as string;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const after = (await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 }).expect(201)).body.updatedAt as string;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('builds a want list from the deck missing cards, grouped by card', async () => {
    const owner = await createSession('fromdeckwant');
    const deckId = await createDeck(owner);
    await ownCopies(owner, CARD_A.cardIdentifier, 1);

    const res = await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'want', name: 'Missing', fromDeckId: deckId }).expect(201);
    const quantities = Object.fromEntries(
      res.body.lines.map((line: { cardIdentifier: string; quantity: number }) => [line.cardIdentifier, line.quantity]),
    );
    expect(quantities).toEqual({ [CARD_A.cardIdentifier]: 2, [CARD_B.cardIdentifier]: 1 });
    expect(res.body.lines).toHaveLength(2);
  });

  it('builds a sell list from every card of the deck, and a deck that is not theirs is DECK_NOT_FOUND', async () => {
    const owner = await createSession('fromdecksell');
    const stranger = await createSession('fromdeckstranger');
    const deckId = await createDeck(owner);

    const res = await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'sell', name: 'Whole deck', fromDeckId: deckId }).expect(201);
    expect(res.body.priceMultiplier).toBe(7);
    expect(res.body.lines.map((line: { cardIdentifier: string; quantity: number }) => [line.cardIdentifier, line.quantity])).toEqual([
      [CARD_A.cardIdentifier, 3],
      [CARD_B.cardIdentifier, 1],
    ]);

    for (const fromDeckId of [deckId, 999999999, 99999999999]) {
      const res404 = await request(server).post('/api/lists').set(...auth(stranger)).send({ kind: 'sell', name: 'Stolen', fromDeckId });
      expect(res404.status).toBe(fromDeckId === 99999999999 ? 400 : 404);
      if (res404.status === 404) expect(res404.body.code).toBe('DECK_NOT_FOUND');
    }
    expect((await request(server).get('/api/lists').set(...auth(stranger)).expect(200)).body).toEqual([]);
  });

  it('does not follow the deck after the list is created', async () => {
    const owner = await createSession('independent');
    const deckId = await createDeck(owner);
    const created = await request(server).post('/api/lists').set(...auth(owner)).send({ kind: 'sell', name: 'Copy', fromDeckId: deckId }).expect(201);
    await dataSource.query(`DELETE FROM deck_card WHERE "trackedDeckId" = $1`, [deckId]);
    await dataSource.query(`DELETE FROM tracked_deck WHERE id = $1`, [deckId]);
    const after = await request(server).get(`/api/lists/${created.body.id}`).set(...auth(owner)).expect(200);
    expect(after.body.lines).toHaveLength(2);
  });

  it('lists the printings of a card for a list, with no suggestion yet', async () => {
    const owner = await createSession('printings');
    const listId = await createList(owner, 'sell');
    const res = await request(server).get(`/api/lists/${listId}/printings/${CARD_C.cardIdentifier}`).set(...auth(owner)).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const option of res.body as { printing: string; label: string; suggestion: unknown }[]) {
      expect(option.printing).toMatch(/^[A-Z0-9]+(\.[A-Z0-9]+)*$/);
      expect(option.label.startsWith(option.printing.split('.')[0] as string)).toBe(true);
      expect(option.suggestion).toBeNull();
    }
    const unknown = await request(server).get(`/api/lists/${listId}/printings/no-such-card`).set(...auth(owner)).expect(400);
    expect(unknown.body.code).toBe('UNKNOWN_CARD');
  });

  it('deletes a list with its lines, and removes lists and lines when the account goes', async () => {
    const owner = await createSession('cascade');
    const listId = await createList(owner, 'sell');
    await addLine(owner, listId, { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 }).expect(201);
    await request(server).delete(`/api/lists/${listId}`).set(...auth(owner)).expect(204);
    await request(server).get(`/api/lists/${listId}`).set(...auth(owner)).expect(404);
    await request(server).delete(`/api/lists/${listId}`).set(...auth(owner)).expect(404);
    const orphans = await dataSource.query(`SELECT 1 FROM card_list_line WHERE "listId" = $1`, [listId]);
    expect(orphans).toHaveLength(0);

    const doomed = await createList(owner, 'want');
    await addLine(owner, doomed, { cardIdentifier: CARD_B.cardIdentifier, quantity: 2 }).expect(201);
    await dataSource.query(`DELETE FROM "user" WHERE id = $1`, [owner.userId]);
    expect(await dataSource.query(`SELECT 1 FROM card_list WHERE "userId" = $1`, [owner.userId])).toHaveLength(0);
    expect(await dataSource.query(`SELECT 1 FROM card_list_line WHERE "listId" = $1`, [doomed])).toHaveLength(0);
  });

  it('keeps two concurrent adds of the same card as one line', async () => {
    const owner = await createSession('concurrent');
    const listId = await createList(owner, 'want');
    const body = { cardIdentifier: CARD_A.cardIdentifier, quantity: 1 };
    await Promise.all([addLine(owner, listId, body), addLine(owner, listId, body), addLine(owner, listId, body)]);
    const res = await request(server).get(`/api/lists/${listId}`).set(...auth(owner)).expect(200);
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].quantity).toBe(3);
  });
  it('a sell line over the collection is allowed and says how many copies the collection holds', async () => {
    const owner = await createSession('over-owned');
    const sell = await createList(owner, 'sell');
    const want = await createList(owner, 'want');
    await ownCopies(owner, CARD_A.cardIdentifier, 1);

    const added = await addLine(owner, sell, { cardIdentifier: CARD_A.cardIdentifier, quantity: 3 }).expect(201);
    const missing = await addLine(owner, sell, { cardIdentifier: CARD_B.cardIdentifier, quantity: 1 }).expect(201);
    const wanted = await addLine(owner, want, { cardIdentifier: CARD_A.cardIdentifier, quantity: 3 }).expect(201);

    expect(added.body.lines[0]).toMatchObject({ quantity: 3, owned: 1 });
    expect(missing.body.lines.find((line: { cardIdentifier: string }) => line.cardIdentifier === CARD_B.cardIdentifier)).toMatchObject({ quantity: 1, owned: 0 });
    expect(wanted.body.lines[0].owned).toBeNull();
  });

  it('marks a line sold in part or whole', async () => {
    const { owner, listId, lineId } = await soldFixture('sold-part', 3);
    const source = await createImport(owner);
    await hold(owner, CARD_A.cardIdentifier, { sourceId: source, ...VERSION_A1, condition: 'NM', quantity: 3 });
    const before = await heldQuantities(owner, CARD_A.cardIdentifier);

    const part = await markSold(owner, listId, lineId, { quantity: 1, removeFromCollection: false }).expect(200);
    const lines = part.body.lines as { id: number; quantity: number; sold: boolean }[];
    expect(lines).toHaveLength(2);
    expect(lines.filter((line) => line.sold).map((line) => line.quantity)).toEqual([1]);
    expect(lines.filter((line) => !line.sold).map((line) => line.quantity)).toEqual([2]);
    expect(part.body.removed).toEqual([]);
    expect(lines.find((line) => line.id === part.body.soldLineId)).toMatchObject({ sold: true, quantity: 1 });
    expect(await heldQuantities(owner, CARD_A.cardIdentifier)).toEqual(before);

    const rest = lines.find((line) => !line.sold)!;
    await markSold(owner, listId, rest.id, { quantity: 0, removeFromCollection: false }).expect(400);
    await markSold(owner, listId, rest.id, { quantity: 3, removeFromCollection: false }).expect(400);
    await markSold(owner, listId, rest.id, { quantity: 1 }).expect(400);
    await markSold(owner, listId, rest.id, { quantity: 1, removeFromCollection: false, extra: true }).expect(400);

    const stranger = await createSession('sold-stranger');
    await markSold(stranger, listId, rest.id, { quantity: 1, removeFromCollection: false }).expect(404);

    const whole = await markSold(owner, listId, rest.id, { quantity: 2, removeFromCollection: false }).expect(200);
    expect((whole.body.lines as { sold: boolean }[]).every((line) => line.sold)).toBe(true);
    expect(whole.body.lines).toHaveLength(2);

    const again = await markSold(owner, listId, rest.id, { quantity: 1, removeFromCollection: false }).expect(409);
    expect(again.body.code).toBe('LINE_ALREADY_SOLD');

    // A line of 3 sold whole: 0 and 4 are refused, 3 marks the one line sold with nothing left on sale.
    const fresh = await soldFixture('sold-whole', 3);
    await markSold(fresh.owner, fresh.listId, fresh.lineId, { quantity: 0, removeFromCollection: false }).expect(400);
    await markSold(fresh.owner, fresh.listId, fresh.lineId, { quantity: 4, removeFromCollection: false }).expect(400);
    const wholeSale = await markSold(fresh.owner, fresh.listId, fresh.lineId, { quantity: 3, removeFromCollection: false }).expect(200);
    expect(wholeSale.body.lines).toHaveLength(1);
    expect(wholeSale.body.lines[0]).toMatchObject({ id: fresh.lineId, quantity: 3, sold: true });
    expect(wholeSale.body.soldLineId).toBe(fresh.lineId);
  });

  it('a sale with removal takes the copies out of the collection', async () => {
    const { owner, listId, lineId } = await soldFixture('sold-removal', 3);
    const source = await createImport(owner);
    await hold(owner, CARD_A.cardIdentifier, { sourceId: source, ...VERSION_A1, condition: 'NM', quantity: 1 });
    await hold(owner, CARD_A.cardIdentifier, { sourceId: source, quantity: 3 });
    await hold(owner, CARD_A.cardIdentifier, { sourceId: source, ...VERSION_A1, condition: 'LP', quantity: 4 });

    const sold = await markSold(owner, listId, lineId, { quantity: 3, removeFromCollection: true }).expect(200);

    expect(sold.body.removed).toEqual([
      { sourceId: source, ...VERSION_A1, condition: 'NM', quantity: 1 },
      { sourceId: source, printingCode: '', edition: '', finish: '', condition: '', quantity: 2 },
    ]);
    const key = (version: IHeldRow): string => [source.slice(0, 4), version.printingCode ?? '', version.edition ?? '', version.finish ?? '', version.condition ?? ''].join('|');
    expect(await heldQuantities(owner, CARD_A.cardIdentifier)).toEqual({
      [key({ sourceId: source, quantity: 0 })]: 1,
      [key({ sourceId: source, ...VERSION_A1, condition: 'LP', quantity: 0 })]: 4,
    });
    const [{ cardCount }] = (await dataSource.query(`SELECT "cardCount" FROM csv_source WHERE id = $1`, [source])) as [{ cardCount: number }];
    expect(cardCount).toBe(2);
  });

  it('asks which import when the card sits in more than one', async () => {
    const { owner, listId, lineId } = await soldFixture('sold-imports', 2);
    const first = await createImport(owner);
    const second = await createImport(owner);
    await hold(owner, CARD_A.cardIdentifier, { sourceId: first, ...VERSION_A1, condition: 'NM', quantity: 2 });
    await hold(owner, CARD_A.cardIdentifier, { sourceId: second, ...VERSION_A1, condition: 'NM', quantity: 2 });
    const before = await heldQuantities(owner, CARD_A.cardIdentifier);

    const refused = await markSold(owner, listId, lineId, { quantity: 1, removeFromCollection: true }).expect(400);
    expect(refused.body.code).toBe('SOURCE_REQUIRED');
    expect(await heldQuantities(owner, CARD_A.cardIdentifier)).toEqual(before);
    const untouched = await request(server).get(`/api/lists/${listId}`).set(...auth(owner)).expect(200);
    expect(untouched.body.lines).toHaveLength(1);
    expect(untouched.body.lines[0].sold).toBe(false);

    const sold = await markSold(owner, listId, lineId, { quantity: 1, removeFromCollection: true, sourceId: second }).expect(200);
    expect(sold.body.removed).toEqual([{ sourceId: second, ...VERSION_A1, condition: 'NM', quantity: 1 }]);
    const after = await heldQuantities(owner, CARD_A.cardIdentifier);
    expect(after[[first.slice(0, 4), VERSION_A1.printingCode, VERSION_A1.edition, VERSION_A1.finish, 'NM'].join('|')]).toBe(2);
    expect(after[[second.slice(0, 4), VERSION_A1.printingCode, VERSION_A1.edition, VERSION_A1.finish, 'NM'].join('|')]).toBe(1);

    const foreignSource = await createImport(await createSession('sold-foreign-source'));
    const other = await soldFixture('sold-imports-2', 1);
    await hold(other.owner, CARD_A.cardIdentifier, { sourceId: await createImport(other.owner), ...VERSION_A1, condition: 'NM', quantity: 1 });
    await markSold(other.owner, other.listId, other.lineId, { quantity: 1, removeFromCollection: true, sourceId: foreignSource }).expect(404);
  });

  it('undoing a sale restores the removed copies', async () => {
    const { owner, listId, lineId } = await soldFixture('sold-undo', 3);
    const source = await createImport(owner);
    await hold(owner, CARD_A.cardIdentifier, { sourceId: source, ...VERSION_A1, condition: 'NM', quantity: 1 });
    await hold(owner, CARD_A.cardIdentifier, { sourceId: source, quantity: 2 });
    const before = await heldQuantities(owner, CARD_A.cardIdentifier);

    const sold = await markSold(owner, listId, lineId, { quantity: 3, removeFromCollection: true }).expect(200);
    expect(await heldQuantities(owner, CARD_A.cardIdentifier)).toEqual({});

    const undo = await request(server)
      .post(`/api/lists/${listId}/lines/${lineId}/unsold`)
      .set(...auth(owner))
      .send({ restore: sold.body.removed })
      .expect(200);

    expect(await heldQuantities(owner, CARD_A.cardIdentifier)).toEqual(before);
    expect(undo.body.lines).toHaveLength(1);
    expect(undo.body.lines[0]).toMatchObject({ quantity: 3, sold: false });
    const [{ cardCount }] = (await dataSource.query(`SELECT "cardCount" FROM csv_source WHERE id = $1`, [source])) as [{ cardCount: number }];
    expect(cardCount).toBe(2);
    await request(server).post(`/api/lists/${listId}/lines/${lineId}/unsold`).set(...auth(owner)).send({ restore: [] }).expect(409);
  });
});

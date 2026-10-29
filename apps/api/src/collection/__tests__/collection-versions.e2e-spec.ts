import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureHttpApp } from '../../http/configure-http-app';
import { sessionCookieHeader, sessionTokenOf } from '../../auth/__tests__/session-test-helpers';

const PASSWORD = 'collection-versions-e2e-password-123';
const SNATCH = 'snatch-red';
const NIMBLISM = 'nimblism-red';
const CRANE_DANCE = 'crane-dance-yellow';
const BLESSING = 'blessing-of-qi-blue';
// Printed only in Rainbow Foil: no plain printing exists.
const FOIL_ONLY = 'anticipating-gaze';
const UNKNOWN_SOURCE = '00000000-0000-4000-8000-000000000000';

interface ITestUser {
  readonly id: string;
  readonly sessionToken: string;
}

interface IVersionRow {
  readonly cardIdentifier: string;
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
  readonly condition: string;
  readonly quantity: number;
}

describe('collection versions (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: ITestUser;
  let other: ITestUser;
  const suffix = Date.now().toString(36);
  const emails: string[] = [];

  async function signUp(label: string): Promise<ITestUser> {
    const server = app.getHttpServer();
    const email = `versions-${label}-${suffix}@test.local`;
    emails.push(email);
    const signUpRes = await request(server).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(201);
    const token = new URL(signUpRes.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    const [row] = await dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    return { id: row.id as string, sessionToken: sessionTokenOf(signIn) };
  }

  function as(user: ITestUser, req: request.Test): request.Test {
    return req.set('Cookie', sessionCookieHeader(user.sessionToken));
  }

  async function createImport(user: ITestUser, label: string): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO csv_source ("userId", kind, label, "cardCount", active) VALUES ($1, 'csv', $2, 0, true) RETURNING id`,
      [user.id, label],
    );
    return row.id as string;
  }

  async function addCopies(
    user: ITestUser,
    sourceId: string,
    cardIdentifier: string,
    quantity: number,
    version: Partial<Pick<IVersionRow, 'printingCode' | 'edition' | 'finish' | 'condition'>> = {},
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", "sourceId", quantity, "printingCode", edition, finish, condition)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        cardIdentifier,
        sourceId,
        quantity,
        version.printingCode ?? '',
        version.edition ?? '',
        version.finish ?? '',
        version.condition ?? '',
      ],
    );
  }

  async function rowsOf(user: ITestUser, sourceId: string): Promise<IVersionRow[]> {
    return dataSource.query(
      `SELECT "cardIdentifier", "printingCode", edition, finish, condition, quantity FROM collection_card
       WHERE "userId" = $1 AND "sourceId" = $2
       ORDER BY "cardIdentifier", "printingCode", edition, finish, condition`,
      [user.id, sourceId],
    );
  }

  async function wipe(user: ITestUser): Promise<void> {
    await dataSource.query(`DELETE FROM collection_card WHERE "userId" = $1`, [user.id]);
    await dataSource.query(`DELETE FROM csv_source WHERE "userId" = $1`, [user.id]);
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

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureHttpApp(app);
    await app.listen(0, '127.0.0.1');
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());

    owner = await signUp('owner');
    other = await signUp('other');
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email = ANY($1)`, [emails]);
    }
    await app?.close();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    await wipe(owner);
    await wipe(other);
  });

  it('bulk marking changes only unversioned copies and lists the skipped cards', async () => {
    const list = await createImport(owner, 'Lista colada em 21/10');
    await addCopies(owner, list, SNATCH, 3);
    await addCopies(owner, list, NIMBLISM, 2);
    await addCopies(owner, list, CRANE_DANCE, 3);
    await addCopies(owner, list, BLESSING, 3);
    await addCopies(owner, list, SNATCH, 1, { finish: 'rainbow' });

    const response = await as(
      owner,
      request(app.getHttpServer()).patch(`/api/collection/sources/${list}/versions`).send({ finish: 'none', condition: 'NM' }),
    ).expect(200);

    expect(response.body).toEqual({ applied: 11, skipped: [] });
    expect(await rowsOf(owner, list)).toEqual([
      { cardIdentifier: BLESSING, printingCode: '', edition: '', finish: 'none', condition: 'NM', quantity: 3 },
      { cardIdentifier: CRANE_DANCE, printingCode: '', edition: '', finish: 'none', condition: 'NM', quantity: 3 },
      { cardIdentifier: NIMBLISM, printingCode: '', edition: '', finish: 'none', condition: 'NM', quantity: 2 },
      { cardIdentifier: SNATCH, printingCode: '', edition: '', finish: 'none', condition: 'NM', quantity: 3 },
      { cardIdentifier: SNATCH, printingCode: '', edition: '', finish: 'rainbow', condition: '', quantity: 1 },
    ]);

    const second = await createImport(owner, 'Armory Deck');
    await addCopies(owner, second, FOIL_ONLY, 2);
    await addCopies(owner, second, SNATCH, 1);

    const skipped = await as(
      owner,
      request(app.getHttpServer()).patch(`/api/collection/sources/${second}/versions`).send({ finish: 'none' }),
    ).expect(200);

    expect(skipped.body).toEqual({ applied: 1, skipped: [FOIL_ONLY] });
    expect(await rowsOf(owner, second)).toEqual([
      { cardIdentifier: FOIL_ONLY, printingCode: '', edition: '', finish: '', condition: '', quantity: 2 },
      { cardIdentifier: SNATCH, printingCode: '', edition: '', finish: 'none', condition: '', quantity: 1 },
    ]);
  });

  it('bulk marking merges into a row that already holds the chosen version', async () => {
    const list = await createImport(owner, 'Lista');
    await addCopies(owner, list, SNATCH, 2);
    await addCopies(owner, list, SNATCH, 1, { finish: 'none', condition: 'NM' });

    await as(
      owner,
      request(app.getHttpServer()).patch(`/api/collection/sources/${list}/versions`).send({ finish: 'none', condition: 'NM' }),
    ).expect(200);

    expect(await rowsOf(owner, list)).toEqual([
      { cardIdentifier: SNATCH, printingCode: '', edition: '', finish: 'none', condition: 'NM', quantity: 3 },
    ]);
  });

  it('bulk marking refuses a bad body and a foreign import', async () => {
    const mine = await createImport(owner, 'Minha lista');
    const theirs = await createImport(other, 'Lista de outra pessoa');
    await addCopies(owner, mine, SNATCH, 2);
    const patch = (user: ITestUser, id: string, body: unknown): request.Test =>
      as(user, request(app.getHttpServer()).patch(`/api/collection/sources/${id}/versions`).send(body as object));

    await patch(owner, mine, { finish: 'foil' }).expect(400);
    await patch(owner, mine, {}).expect(400);
    await patch(owner, mine, { edition: '', finish: '' }).expect(400);
    await patch(owner, mine, { edition: 'second' }).expect(400);
    await patch(owner, theirs, { finish: 'none' }).expect(404);
    await patch(owner, UNKNOWN_SOURCE, { finish: 'none' }).expect(404);

    expect(await rowsOf(owner, mine)).toEqual([
      { cardIdentifier: SNATCH, printingCode: '', edition: '', finish: '', condition: '', quantity: 2 },
    ]);
  });

  it('lists the copies of an import with their sums', async () => {
    const list = await createImport(owner, 'Lista colada em 21/10');
    await addCopies(owner, list, SNATCH, 2);
    await addCopies(owner, list, SNATCH, 1, { printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'NM' });

    const response = await as(owner, request(app.getHttpServer()).get(`/api/collection/sources/${list}/copies`)).expect(200);

    expect(response.body.copies).toBe(3);
    expect(response.body.withoutVersion).toBe(2);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({ cardIdentifier: SNATCH, name: 'Snatch', pitch: 1, quantity: 2 });
    await as(other, request(app.getHttpServer()).get(`/api/collection/sources/${list}/copies`)).expect(404);
  });

  it('moving copies between versions answers 200, 400 and 404', async () => {
    const list = await createImport(owner, 'Lista');
    await addCopies(owner, list, SNATCH, 2);
    await addCopies(owner, list, SNATCH, 1, { printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'NM' });
    const none = { printingCode: '', edition: '', finish: '', condition: '' };
    const target = { printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'NM' };
    const move = (user: ITestUser, card: string, body: unknown): request.Test =>
      as(user, request(app.getHttpServer()).patch(`/api/collection/cards/${card}/versions`).send(body as object));

    const moved = await move(owner, SNATCH, { from: none, to: target, quantity: 1 }).expect(200);

    expect(moved.body.versions).toEqual([
      { ...none, quantity: 1 },
      { ...target, quantity: 2 },
    ]);
    await move(owner, SNATCH, { from: none, to: target, quantity: 0 }).expect(400);
    await move(owner, SNATCH, { from: none, to: target, quantity: 2 }).expect(400);
    await move(other, SNATCH, { from: none, to: target, quantity: 1 }).expect(404);
    await move(owner, NIMBLISM, { from: none, to: none, quantity: 1 }).expect(404);
    expect(await rowsOf(owner, list)).toEqual([
      { cardIdentifier: SNATCH, ...none, quantity: 1 },
      { cardIdentifier: SNATCH, ...target, quantity: 2 },
    ]);
  });

  it('moving the last copies of a version removes its row', async () => {
    const list = await createImport(owner, 'Lista');
    await addCopies(owner, list, SNATCH, 2);
    const none = { printingCode: '', edition: '', finish: '', condition: '' };

    const moved = await as(
      owner,
      request(app.getHttpServer())
        .patch(`/api/collection/cards/${SNATCH}/versions`)
        .send({ from: none, to: { ...none, printingCode: 'WTR167', edition: 'alpha' }, quantity: 2 }),
    ).expect(200);

    expect(moved.body.versions).toEqual([{ printingCode: 'WTR167', edition: 'alpha', finish: '', condition: '', quantity: 2 }]);
    expect(await rowsOf(owner, list)).toHaveLength(1);
  });

  it('a version the card does not have is refused on every write', async () => {
    const list = await createImport(owner, 'Lista');
    await addCopies(owner, list, SNATCH, 2);
    const none = { printingCode: '', edition: '', finish: '', condition: '' };
    const server = app.getHttpServer();

    await as(
      owner,
      request(server)
        .patch(`/api/collection/cards/${SNATCH}/versions`)
        .send({ from: none, to: { ...none, printingCode: 'WTR023' }, quantity: 1 }),
    ).expect(400);
    await as(
      owner,
      request(server)
        .patch(`/api/collection/cards/${SNATCH}/versions`)
        .send({ from: none, to: { ...none, printingCode: 'WTR167', edition: 'first' }, quantity: 1 }),
    ).expect(400);
    await as(
      owner,
      request(server)
        .patch(`/api/collection/cards/${SNATCH}/versions`)
        .send({ from: none, to: { ...none, printingCode: 'WTR167', finish: 'gold' }, quantity: 1 }),
    ).expect(400);
    await as(owner, request(server).post('/api/collection/cards/batch').send({ items: [{ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR023' }] })).expect(400);
    await as(owner, request(server).post('/api/collection/cards/batch').send({ items: [{ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR167', edition: 'first' }] })).expect(400);
    await as(owner, request(server).post('/api/collection/cards/batch').send({ items: [{ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR167', finish: 'gold' }] })).expect(400);
    const [{ id: pendingId }] = await dataSource.query(
      `INSERT INTO import_pending_line ("sourceId", "userId", "lineNumber", "originalText", reason)
       VALUES ($1, $2, 3, 'Snatch,2,', 'asks_color') RETURNING id`,
      [list, owner.id],
    );
    await as(
      owner,
      request(server).patch(`/api/collection/pending/${pendingId}`).send({ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR023' }),
    ).expect(400);
    await as(
      owner,
      request(server).patch(`/api/collection/pending/${pendingId}`).send({ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR167', edition: 'first' }),
    ).expect(400);

    await as(
      owner,
      request(server).patch(`/api/collection/pending/${pendingId}`).send({ cardIdentifier: SNATCH, quantity: 1, printingCode: 'WTR167', finish: 'gold' }),
    ).expect(400);

    // Undoing a sale puts copies back at a version: it cannot mint one the card lacks, nor one the sold line never held.
    const sellList = (await as(owner, request(server).post('/api/lists').send({ kind: 'sell', name: 'Vendo' })).expect(201)).body.id as number;
    const soldLine = (await as(owner, request(server).post(`/api/lists/${sellList}/lines`).send({ cardIdentifier: SNATCH, quantity: 1 })).expect(201)).body
      .lines[0].id as number;
    await as(owner, request(server).post(`/api/lists/${sellList}/lines/${soldLine}/sold`).send({ quantity: 1, removeFromCollection: false })).expect(200);
    for (const bad of [{ printingCode: 'WTR023' }, { printingCode: 'WTR167', edition: 'first' }, { printingCode: 'WTR167', finish: 'gold' }, { printingCode: 'WTR167' }]) {
      await as(
        owner,
        request(server)
          .post(`/api/lists/${sellList}/lines/${soldLine}/unsold`)
          .send({ restore: [{ sourceId: list, ...{ printingCode: '', edition: '', finish: '', condition: '' }, ...bad, quantity: 1 }] }),
      ).expect(400);
    }

    const [{ stillPending }] = await dataSource.query(
      `SELECT count(*)::int AS "stillPending" FROM import_pending_line WHERE id = $1`,
      [pendingId],
    );
    expect(stillPending).toBe(1);
    expect(await rowsOf(owner, list)).toEqual([{ cardIdentifier: SNATCH, ...none, quantity: 2 }]);
    const [{ total }] = await dataSource.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS total FROM collection_card WHERE "userId" = $1`,
      [owner.id],
    );
    expect(total).toBe(2);
  });

  it('decrement takes one copy from the named import and version', async () => {
    const first = await createImport(owner, 'Primeira');
    const second = await createImport(owner, 'Segunda');
    const target = { printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'NM' };
    await addCopies(owner, first, SNATCH, 2);
    await addCopies(owner, first, SNATCH, 2, target);
    await addCopies(owner, second, SNATCH, 1);
    const decrement = (body: unknown): request.Test =>
      as(owner, request(app.getHttpServer()).post('/api/collection/cards/decrement').send(body as object));

    const done = await decrement({ cardIdentifier: SNATCH, sourceId: first, ...target }).expect(201);

    expect(done.body).toMatchObject({ newQuantity: 1, removed: false });
    expect(await rowsOf(owner, first)).toEqual([
      { cardIdentifier: SNATCH, printingCode: '', edition: '', finish: '', condition: '', quantity: 2 },
      { cardIdentifier: SNATCH, ...target, quantity: 1 },
    ]);
    expect(await rowsOf(owner, second)).toHaveLength(1);

    await decrement({ cardIdentifier: SNATCH }).expect(400);
    await decrement({ cardIdentifier: SNATCH, sourceId: second, ...target }).expect(404);
    await decrement({ cardIdentifier: SNATCH, sourceId: first, printingCode: 'WTR167', finish: 'rainbow' }).expect(404);
  });

  it('decrement without an import takes from the one row the card has', async () => {
    const only = await createImport(owner, 'Única');
    const target = { printingCode: 'WTR167', edition: 'alpha', finish: 'none', condition: 'LP' };
    await addCopies(owner, only, SNATCH, 1, target);

    const done = await as(
      owner,
      request(app.getHttpServer()).post('/api/collection/cards/decrement').send({ cardIdentifier: SNATCH }),
    ).expect(201);

    expect(done.body).toMatchObject({ newQuantity: 0, removed: true, sourceId: only });
    await as(
      owner,
      request(app.getHttpServer()).post('/api/collection/cards/decrement').send({ cardIdentifier: SNATCH }),
    ).expect(404);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { CatalogService } from '../../catalog/catalog.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

const PASSWORD = 'collection-batch-e2e-password-123';
const CARD_A = 'nimblism-red';
const CARD_B = 'crane-dance-yellow';
const CARD_C = 'blessing-of-qi-blue';
const CARD_D = 'knife-through-butter-yellow';

interface ITestUser {
  readonly id: string;
  readonly jwt: string;
}

describe('POST /api/collection/cards/batch (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let catalogService: CatalogService;
  let owner: ITestUser;
  let other: ITestUser;
  let fresh: ITestUser;
  const suffix = Date.now().toString(36);
  const emails: string[] = [];

  async function signUp(label: string): Promise<ITestUser> {
    const server = app.getHttpServer();
    const email = `batch-${label}-${suffix}@test.local`;
    emails.push(email);
    const signUpRes = await request(server).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(202);
    const token = new URL(signUpRes.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    const [row] = await dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    return { id: row.id as string, jwt: signIn.body.jwt as string };
  }

  function batch(user: ITestUser | null, items: unknown): request.Test {
    const req = request(app.getHttpServer()).post('/api/collection/cards/batch');
    return (user ? req.set('Authorization', `Bearer ${user.jwt}`) : req).send({ items });
  }

  async function quantityOf(user: ITestUser, cardIdentifier: string): Promise<number> {
    const [row] = await dataSource.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS total FROM collection_card WHERE "userId" = $1 AND "cardIdentifier" = $2`,
      [user.id, cardIdentifier],
    );
    return row.total as number;
  }

  async function resetCollection(user: ITestUser): Promise<void> {
    await dataSource.query(`DELETE FROM collection_card WHERE "userId" = $1`, [user.id]);
  }

  async function seed(user: ITestUser, cardIdentifier: string, quantity: number): Promise<void> {
    await batch(user, [{ cardIdentifier, quantity }]).expect(201);
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

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
    catalogService = moduleRef.get(CatalogService);

    owner = await signUp('owner');
    other = await signUp('other');
    fresh = await signUp('fresh');
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email = ANY($1)`, [emails]);
    }
    await app?.close();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    await resetCollection(owner);
  });

  it('rejects both scanner routes without a token', async () => {
    const server = app.getHttpServer();

    await request(server).get('/api/catalog/collector-codes').expect(401);
    await batch(null, [{ cardIdentifier: CARD_A, quantity: 1 }]).expect(401);
  });

  it('adds quantities to the manual source', async () => {
    await seed(owner, CARD_A, 1);

    const response = await batch(owner, [
      { cardIdentifier: CARD_A, quantity: 2 },
      { cardIdentifier: CARD_B, quantity: 1 },
    ]).expect(201);

    expect(response.body.results).toEqual(
      expect.arrayContaining([
        { cardIdentifier: CARD_A, newQuantity: 3, capped: false },
        { cardIdentifier: CARD_B, newQuantity: 1, capped: false },
      ]),
    );
    expect(await quantityOf(owner, CARD_A)).toBe(3);
    expect(await quantityOf(owner, CARD_B)).toBe(1);
    const sources = await dataSource.query(
      `SELECT DISTINCT s.kind FROM collection_card c JOIN csv_source s ON s.id = c."sourceId" WHERE c."userId" = $1`,
      [owner.id],
    );
    expect(sources).toEqual([{ kind: 'manual' }]);
  });

  it.each([
    [19, 1, 20, false],
    [19, 2, 20, true],
    [20, 1, 20, true],
    [0, 20, 20, false],
  ])('caps the stored quantity at 20: %i + %i -> %i, capped %s', async (before, added, after, capped) => {
    if (before > 0) await seed(owner, CARD_C, before);

    const response = await batch(owner, [{ cardIdentifier: CARD_C, quantity: added }]).expect(201);

    expect(response.body.results).toEqual([{ cardIdentifier: CARD_C, newQuantity: after, capped }]);
    expect(await quantityOf(owner, CARD_C)).toBe(after);
  });

  it('sums duplicate identifiers', async () => {
    await batch(owner, [
      { cardIdentifier: CARD_A, quantity: 2 },
      { cardIdentifier: CARD_A, quantity: 3 },
    ]).expect(201);

    expect(await quantityOf(owner, CARD_A)).toBe(5);
  });

  it('loses no increment under concurrency', async () => {
    const capped = await Promise.all(
      Array.from({ length: 30 }, () => batch(fresh, [{ cardIdentifier: CARD_A, quantity: 1 }])),
    );
    const uncapped = await Promise.all(
      Array.from({ length: 15 }, () => batch(fresh, [{ cardIdentifier: CARD_B, quantity: 1 }])),
    );

    expect([...capped, ...uncapped].map((response) => response.status)).toEqual(Array(45).fill(201));
    expect(await quantityOf(fresh, CARD_A)).toBe(20);
    expect(await quantityOf(fresh, CARD_B)).toBe(15);
  });

  it('rejects an unknown card and writes nothing', async () => {
    await seed(owner, CARD_A, 1);

    const response = await batch(owner, [
      { cardIdentifier: CARD_A, quantity: 1 },
      { cardIdentifier: 'not-a-real-card', quantity: 1 },
    ]).expect(400);

    expect(response.body.code).toBe('INVALID_CARD_IDENTIFIER');
    expect(await quantityOf(owner, CARD_A)).toBe(1);
    expect(await quantityOf(owner, 'not-a-real-card')).toBe(0);
  });

  describe('enforces item and quantity bounds', () => {
    const twoHundredCards = (): string[] =>
      catalogService
        .listCollectorCodes()
        .cards.slice(0, 201)
        .map((card) => card.cardIdentifier);

    it('rejects items that are not a list', async () => {
      await batch(owner, { cardIdentifier: CARD_D, quantity: 1 }).expect(400);
    });

    it.each([
      ['0 items', (): unknown[] => []],
      ['201 items', (): unknown[] => twoHundredCards().map((cardIdentifier) => ({ cardIdentifier, quantity: 1 }))],
      ['quantity 0', (): unknown[] => [{ cardIdentifier: CARD_D, quantity: 0 }]],
      ['quantity 21', (): unknown[] => [{ cardIdentifier: CARD_D, quantity: 21 }]],
      ['a fractional quantity', (): unknown[] => [{ cardIdentifier: CARD_D, quantity: 1.5 }]],
      ['a numeric card identifier', (): unknown[] => [{ cardIdentifier: 42, quantity: 1 }]],
      ['an unknown field', (): unknown[] => [{ cardIdentifier: CARD_D, quantity: 1, foil: true }]],
    ])('rejects %s', async (_label, items) => {
      await batch(owner, items()).expect(400);

      const [row] = await dataSource.query(
        `SELECT COUNT(*)::int AS rows FROM collection_card WHERE "userId" = $1`,
        [owner.id],
      );
      expect(row.rows).toBe(0);
    });

    it('accepts 200 items at quantity 20', async () => {
      const items = twoHundredCards()
        .slice(0, 200)
        .map((cardIdentifier) => ({ cardIdentifier, quantity: 20 }));

      const response = await batch(owner, items).expect(201);

      expect(response.body.results).toHaveLength(200);
    });
  });

  it('refreshes readiness of a deck that needs the card', async () => {
    const server = app.getHttpServer();
    const deckWith = async (cardIdentifiers: readonly string[]): Promise<number> => {
      const created = await request(server)
        .post('/api/decks')
        .set('Authorization', `Bearer ${owner.jwt}`)
        .send({ heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' })
        .expect(201);
      const deckId = created.body.id as number;
      await request(server)
        .put(`/api/decks/${deckId}`)
        .set('Authorization', `Bearer ${owner.jwt}`)
        .send({
          heroIdentifier: 'katsu-the-wanderer',
          format: 'Classic Constructed',
          cards: cardIdentifiers.map((cardIdentifier) => ({ cardIdentifier, quantity: 2, slot: 'mainboard' })),
        })
        .expect(200);
      return deckId;
    };
    const snapshotCount = async (deckId: number): Promise<number> => {
      const [row] = await dataSource.query(
        `SELECT COUNT(*)::int AS snapshots FROM deck_readiness_snapshot WHERE "trackedDeckId" = $1`,
        [deckId],
      );
      return row.snapshots as number;
    };
    const latestRawPercent = async (deckId: number): Promise<number> => {
      const [row] = await dataSource.query(
        `SELECT "rawPercent" FROM deck_readiness_snapshot WHERE "trackedDeckId" = $1 ORDER BY "computedAt" DESC, id DESC LIMIT 1`,
        [deckId],
      );
      return Number(row?.rawPercent ?? 0);
    };
    const withAAndB = await deckWith([CARD_A, CARD_B]);
    const withB = await deckWith([CARD_B]);
    const withNeither = await deckWith([CARD_C]);
    const before = await Promise.all([withAAndB, withB, withNeither].map(snapshotCount));

    const response = await batch(owner, [
      { cardIdentifier: CARD_A, quantity: 2 },
      { cardIdentifier: CARD_B, quantity: 2 },
    ]).expect(201);

    const after = await Promise.all([withAAndB, withB, withNeither].map(snapshotCount));
    expect(response.body.recomputedDeckCount).toBe(2);
    expect(after.map((count, index) => count - before[index]!)).toEqual([1, 1, 0]);
    expect(await latestRawPercent(withAAndB)).toBe(100);
    expect(await latestRawPercent(withB)).toBe(100);
    expect(await latestRawPercent(withNeither)).toBeLessThan(100);
  });

  it("writes only the caller's rows", async () => {
    await resetCollection(other);
    await seed(other, CARD_D, 4);

    await batch(owner, [{ cardIdentifier: CARD_D, quantity: 3 }]).expect(201);

    expect(await quantityOf(other, CARD_D)).toBe(4);
    expect(await quantityOf(owner, CARD_D)).toBe(3);
  });
});

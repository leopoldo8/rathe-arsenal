import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createMock } from '@golevelup/ts-jest';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { FabraryService } from '../../fabrary/fabrary.service';

const COAX = 'coax-a-commotion-red';
const EMISSARY = 'emissary-of-tides-red';
const FLEX = 'flex-red';
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';
const FABRARY_URL = 'https://fabrary.net/decks/01HPABCDEFGHJKMN0000000SW1';

// Two originals with coax's exact profile share two owned coax copies one
// each; rejecting one pair frees its copy for the other original.
const CSV_BUFFER = Buffer.from(['Name,Quantity', 'Coax a Commotion,2'].join('\n'), 'utf-8');

const DECK_DTO: IDeckImportDto = {
  ulid: '01HPABCDEFGHJKMN0000000SW1',
  name: 'Swaps Lifecycle Deck',
  format: 'Classic Constructed',
  hero: { cardIdentifier: 'katsu-the-wanderer', name: 'Katsu, the Wanderer' },
  mainboard: [
    { cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
    { cardIdentifier: FLEX, quantity: 2, slot: 'mainboard' },
  ],
  equipment: [],
  weapons: [{ cardIdentifier: 'talishar-the-lost-prince', quantity: 1, slot: 'weapon' }],
  inventory: [],
};

const DECK_CARD_TOTAL =
  1 +
  [...DECK_DTO.mainboard, ...DECK_DTO.weapons].reduce((sum, card) => sum + card.quantity, 0);

// Mirrors the engine's one-decimal rounding: only the approved row's quantity is added.
function percentAfterApproving(baselinePercent: number, approvedQuantity: number): number {
  const countedCards = (baselinePercent / 100) * DECK_CARD_TOTAL + approvedQuantity;
  return Math.round((countedCards / DECK_CARD_TOTAL) * 1000) / 10;
}

interface ISwapRowBody {
  readonly id: string;
  readonly cardIdentifier: string;
  readonly substituteIdentifier: string;
  readonly quantity: number;
  readonly ownedCount: number;
  readonly status: string;
  readonly appliedAt: string | null;
  readonly rejectionReason: string | null;
  readonly rejectionNote: string | null;
  readonly outcome: string | null;
}

interface IMutationBody {
  readonly deckId: number;
  readonly swap: ISwapRowBody;
  readonly rows: readonly ISwapRowBody[];
}

describe('Swaps lifecycle (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const suffix = Date.now().toString(36);
  const OWNER_EMAIL = `swaps-owner-${suffix}@test.local`;
  const STRANGER_EMAIL = `swaps-stranger-${suffix}@test.local`;
  const PASSWORD = 'swaps-e2e-password-123';

  let ownerJwt: string;
  let strangerJwt: string;
  let deckId: number;

  async function signUpAndIn(email: string): Promise<string> {
    const server = app.getHttpServer();
    const signUp = await request(server).post('/api/auth/sign-up').send({ email, password: PASSWORD }).expect(202);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server).post('/api/auth/sign-in').send({ email, password: PASSWORD }).expect(200);
    return signIn.body.jwt as string;
  }

  function post(path: string, jwt: string = ownerJwt): request.Test {
    return request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${jwt}`);
  }

  function get(path: string, jwt: string = ownerJwt): request.Test {
    return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${jwt}`);
  }

  async function effectivePercent(): Promise<number> {
    const res = await get('/api/decks').expect(200);
    const decks = res.body.trackedDecks as Array<{ id: number; latestSnapshot: { effectivePercent: number } | null }>;
    const snapshot = decks.find((d) => d.id === deckId)?.latestSnapshot;
    if (!snapshot) throw new Error('deck has no readiness snapshot');
    return snapshot.effectivePercent;
  }

  async function pendingRows(): Promise<ISwapRowBody[]> {
    const res = await get('/api/swaps?state=pending').expect(200);
    return res.body.rows as ISwapRowBody[];
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

    const fabrary = createMock<FabraryService>();
    fabrary.fetchDeck.mockResolvedValue(DECK_DTO);

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FabraryService)
      .useValue(fabrary)
      .compile();

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
    await app.init();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());

    ownerJwt = await signUpAndIn(OWNER_EMAIL);
    strangerJwt = await signUpAndIn(STRANGER_EMAIL);

    await post('/api/collection/csv')
      .attach('file', CSV_BUFFER, { filename: 'swaps.csv', contentType: 'text/csv' })
      .expect(201);
    const importRes = await post('/api/decks/import')
      .send({ urls: [FABRARY_URL], seedInventory: false })
      .expect(201);
    deckId = importRes.body.imported[0].trackedDeckId as number;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DELETE FROM "user" WHERE email = ANY($1)`, [[OWNER_EMAIL, STRANGER_EMAIL]]);
    }
    await app?.close();
    jest.restoreAllMocks();
  });

  it('proposes one pending suggestion per original, splitting the two coax copies', async () => {
    const rows = await pendingRows();

    expect(rows.map((r) => r.cardIdentifier).sort()).toEqual([EMISSARY, FLEX]);
    for (const row of rows) {
      expect(row).toEqual(
        expect.objectContaining({ substituteIdentifier: COAX, quantity: 1, ownedCount: 2, status: 'pending' }),
      );
    }
  });

  it('serializes concurrent approvals on the same deck instead of deadlocking', async () => {
    const rows = await pendingRows();
    const baseline = await effectivePercent();

    const responses = await Promise.all(rows.map((row) => post(`/api/swaps/${row.id}/approve`)));

    expect(responses.map((res) => res.status)).toEqual(rows.map(() => 200));
    const approved = (await get('/api/swaps?state=approved').expect(200)).body.rows as ISwapRowBody[];
    expect(approved.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
    expect(await effectivePercent()).toBeGreaterThan(baseline);

    await Promise.all(rows.map((row) => post(`/api/swaps/${row.id}/revert`).expect(200)));
    expect(await effectivePercent()).toBe(baseline);
  });

  it('drives approve, revert, reject, restore and outcome through the real database', async () => {
    const initial = await pendingRows();
    const first = initial.find((r) => r.cardIdentifier === EMISSARY);
    const sibling = initial.find((r) => r.cardIdentifier === FLEX);
    if (!first || !sibling) throw new Error('fixture did not produce both suggestions');
    const baseline = await effectivePercent();

    const approved = (await post(`/api/swaps/${first.id}/approve`).expect(200)).body as IMutationBody;
    expect(approved.deckId).toBe(deckId);
    expect(approved.swap).toEqual(expect.objectContaining({ id: first.id, status: 'approved' }));
    expect(approved.swap.appliedAt).not.toBeNull();
    const afterApprove = await effectivePercent();
    expect(afterApprove).toBe(percentAfterApproving(baseline, first.quantity));

    const repeated = (await post(`/api/swaps/${first.id}/approve`).expect(200)).body as IMutationBody;
    expect(repeated.swap.appliedAt).toBe(approved.swap.appliedAt);

    const illegal = await post(`/api/swaps/${first.id}/reject`).send({}).expect(409);
    expect(illegal.body.code).toBe('INVALID_TRANSITION');

    const reverted = (await post(`/api/swaps/${first.id}/revert`).expect(200)).body as IMutationBody;
    expect(reverted.swap).toEqual(expect.objectContaining({ status: 'pending', appliedAt: null }));
    expect(await effectivePercent()).toBe(baseline);

    const rejected = (
      await post(`/api/swaps/${first.id}/reject`).send({ reason: 'dont_own', note: 'sold them' }).expect(200)
    ).body as IMutationBody;
    expect(rejected.swap).toEqual(
      expect.objectContaining({ status: 'rejected', rejectionReason: 'dont_own', rejectionNote: 'sold them' }),
    );
    const cascaded = rejected.rows.find((r) => r.cardIdentifier === FLEX);
    expect(cascaded).toEqual(
      expect.objectContaining({ id: sibling.id, substituteIdentifier: COAX, quantity: 2, status: 'pending' }),
    );

    const rejectedList = (await get('/api/swaps?state=rejected').expect(200)).body.rows as ISwapRowBody[];
    expect(rejectedList.map((r) => r.id)).toEqual([first.id]);

    const restored = (await post(`/api/swaps/${first.id}/restore`).expect(200)).body as IMutationBody;
    expect(restored.swap).toEqual(
      expect.objectContaining({ status: 'pending', rejectionReason: null, rejectionNote: null }),
    );
    expect(restored.rows.map((r) => r.id).sort()).toEqual([first.id, sibling.id].sort());

    const outcomeOnPending = await post(`/api/swaps/${first.id}/outcome`).send({ outcome: 'worked' }).expect(409);
    expect(outcomeOnPending.body.code).toBe('INVALID_TRANSITION');

    await post(`/api/swaps/${first.id}/approve`).expect(200);
    const withOutcome = (await post(`/api/swaps/${first.id}/outcome`).send({ outcome: 'worked' }).expect(200))
      .body as IMutationBody;
    expect(withOutcome.swap.outcome).toBe('worked');

    const persisted = await dataSource.query(
      `SELECT status, outcome, "appliedAt" FROM swap_suggestion WHERE id = $1`,
      [first.id],
    );
    expect(persisted[0]).toEqual(expect.objectContaining({ status: 'approved', outcome: 'worked' }));
    expect(persisted[0].appliedAt).not.toBeNull();
  });

  it('rejects malformed input with 400', async () => {
    const [row] = await pendingRows();
    const anyId = row?.id ?? RANDOM_UUID;

    await post(`/api/swaps/${anyId}/reject`).send({ reason: 'because' }).expect(400);
    await post(`/api/swaps/${anyId}/outcome`).send({ outcome: 'meh' }).expect(400);
    await get('/api/swaps?state=retired').expect(400);
  });

  it.each([
    ['approve', {}],
    ['reject', {}],
    ['revert', {}],
    ['restore', {}],
    ['outcome', { outcome: 'worked' }],
  ])('answers 400 for a malformed id on %s even with a valid body', async (action, body) => {
    await post(`/api/swaps/not-a-uuid/${action}`).send(body).expect(400);
  });

  it('accepts a 500-character rejection note and rejects 501', async () => {
    const [row] = await pendingRows();
    if (!row) throw new Error('fixture did not produce a pending suggestion');

    await post(`/api/swaps/${row.id}/reject`).send({ note: 'n'.repeat(501) }).expect(400);
    const accepted = (await post(`/api/swaps/${row.id}/reject`).send({ note: 'n'.repeat(500) }).expect(200))
      .body as IMutationBody;
    expect(accepted.swap.rejectionNote).toHaveLength(500);

    await post(`/api/swaps/${row.id}/restore`).expect(200);
  });

  it("answers another user's swap id exactly like an id that does not exist", async () => {
    const [ownerRow] = (await get('/api/swaps?state=all').expect(200)).body.rows as ISwapRowBody[];
    if (!ownerRow) throw new Error('owner has no swaps');

    const foreign = await post(`/api/swaps/${ownerRow.id}/approve`, strangerJwt).expect(404);
    const missing = await post(`/api/swaps/${RANDOM_UUID}/approve`, strangerJwt).expect(404);

    const { timestamp: _foreignTs, ...foreignBody } = foreign.body as Record<string, unknown>;
    const { timestamp: _missingTs, ...missingBody } = missing.body as Record<string, unknown>;
    expect(foreignBody).toEqual(missingBody);

    const strangerRows = (await get('/api/swaps?state=all', strangerJwt).expect(200)).body.rows;
    expect(strangerRows).toEqual([]);
  });
});

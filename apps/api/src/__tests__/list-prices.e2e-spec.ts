/**
 * Price suggestions E2E: suggestion on read, the multiplier, apply-suggestions, the printings route with
 * suggestions, and one sync pass against a fake tcgcsv client. Needs a real Postgres (DATABASE_URL) with
 * NODE_ENV=development so TypeORM synchronizes the schema, like the other e2e specs. No network.
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
import { ICardPrinting, printingsOfCard, printingVersion } from '../lists/printing-key';
import { priceKeysOf } from '../prices/price-suggestion';
import { MAX_CONSECUTIVE_GROUP_FAILURES, PRICE_SYNC_LOCK_KEY, PriceSyncService } from '../prices/price-sync.service';
import { printingSubType } from '../prices/price-sub-type';
import { ITcgcsvClient } from '../prices/tcgcsv-client';
import { sessionCookieHeader, sessionTokenOf } from '../auth/__tests__/session-test-helpers';

const PASSWORD = 'prices-test-password-123';
const SUFFIX = Date.now().toString(36);
const emailFor = (label: string): string => `prices-e2e-${label}-${SUFFIX}@test.local`;
const FAKE_PRODUCT_PREFIX = `e2e${SUFFIX}`;
const FETCHED_AT = '2026-10-18T20:30:00.000Z';

function priceable(card: ICatalogCard): ICardPrinting[] {
  const seen = new Set<string>();
  return (printingsOfCard(card.cardIdentifier) ?? []).filter((printing) => {
    const key = priceKeysOf(printing);
    if (key === null || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const CARDS = catalog.cards.filter((card) => card.pitch === 1 && card.types[0] !== 'Hero');
const CARD = CARDS.find((card) => {
  const printings = priceable(card);
  return printings.some((p) => p.foiling === null) && printings.some((p) => p.foiling !== null);
}) as ICatalogCard;
const NO_PRICE_CARD = CARDS.find((card) => card.cardIdentifier !== CARD.cardIdentifier) as ICatalogCard;
const PRINTINGS = priceable(CARD);
const NORMAL = PRINTINGS.find((p) => p.foiling === null) as ICardPrinting;
const FOIL = PRINTINGS.find((p) => p.foiling !== null) as ICardPrinting;

describe('Card list prices (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let server: ReturnType<INestApplication['getHttpServer']>;
  const seededProductIds: string[] = [];

  const auth = (sessionToken: string): [string, string] => ['Cookie', sessionCookieHeader(sessionToken)];

  async function createSession(label: string): Promise<string> {
    const signUp = await request(server).post('/api/auth/sign-up').send({ email: emailFor(label), password: PASSWORD }).expect(201);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    return sessionTokenOf(signUp);
  }

  async function seedPrice(printing: ICardPrinting, market: number | null, mid: number | null): Promise<void> {
    const subType = printingSubType(printing.foiling, printing.edition) as string;
    seededProductIds.push(printing.productId as string);
    await dataSource.query(
      `INSERT INTO card_price ("productId", "subType", "marketPriceCents", "midPriceCents", "fetchedAt")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("productId", "subType") DO UPDATE SET "marketPriceCents" = $3, "midPriceCents" = $4, "fetchedAt" = $5`,
      [printing.productId, subType, market, mid, FETCHED_AT],
    );
  }

  async function sellList(sessionToken: string): Promise<number> {
    const res = await request(server).post('/api/lists').set(...auth(sessionToken)).send({ kind: 'sell', name: 'Prices' }).expect(201);
    return res.body.id as number;
  }

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
      await dataSource.query(`DELETE FROM "user" WHERE email LIKE $1`, [`prices-e2e-%-${SUFFIX}@test.local`]);
      await dataSource.query(`DELETE FROM card_price WHERE "productId" = ANY($1::varchar[])`, [seededProductIds]);
      await dataSource.query(`DELETE FROM card_price WHERE "productId" LIKE $1`, [`${FAKE_PRODUCT_PREFIX}%`]);
      await dataSource.query(`DELETE FROM card_price_group_sync WHERE "groupId" >= 910000 AND "groupId" < 911000`);
    }
    await app?.close();
    jest.clearAllMocks();
  });

  it('suggests the cheapest non-foil printing, or the chosen printing, times the multiplier in whole reais', async () => {
    const sessionToken = await createSession('suggest');
    const listId = await sellList(sessionToken);
    await seedPrice(NORMAL, 200, 220);
    await seedPrice(FOIL, 100, 110);
    const base = { cardIdentifier: CARD.cardIdentifier, quantity: 1 };

    await request(server).post(`/api/lists/${listId}/lines`).set(...auth(sessionToken)).send(base).expect(201);
    await request(server).post(`/api/lists/${listId}/lines`).set(...auth(sessionToken)).send({ ...base, ...printingVersion(FOIL) }).expect(201);
    await request(server).post(`/api/lists/${listId}/lines`).set(...auth(sessionToken)).send({ cardIdentifier: NO_PRICE_CARD.cardIdentifier, quantity: 1 }).expect(201);

    const res = await request(server).get(`/api/lists/${listId}`).set(...auth(sessionToken)).expect(200);
    expect(res.body.lines[0].suggestion).toEqual({ cents: 1400, approximate: false, fetchedAt: FETCHED_AT, printing: NORMAL.key });
    expect(res.body.lines[1].suggestion).toEqual({ cents: 700, approximate: false, fetchedAt: FETCHED_AT, printing: FOIL.key });
    expect(res.body.lines[2].suggestion).toBeNull();

    const sixX = await request(server).patch(`/api/lists/${listId}`).set(...auth(sessionToken)).send({ priceMultiplier: 6 }).expect(200);
    expect(sixX.body.lines[0].suggestion.cents).toBe(1200);
    const cleared = await request(server).patch(`/api/lists/${listId}`).set(...auth(sessionToken)).send({ priceMultiplier: null }).expect(200);
    expect(cleared.body.lines.every((line: { suggestion: unknown }) => line.suggestion === null)).toBe(true);
  });

  it('marks a mid-price suggestion approximate', async () => {
    const sessionToken = await createSession('approx');
    const listId = await sellList(sessionToken);
    await seedPrice(NORMAL, null, 300);
    await seedPrice(FOIL, null, 500);
    const res = await request(server)
      .post(`/api/lists/${listId}/lines`)
      .set(...auth(sessionToken))
      .send({ cardIdentifier: CARD.cardIdentifier, quantity: 1 })
      .expect(201);
    expect(res.body.lines[0].suggestion).toMatchObject({ cents: 2100, approximate: true, printing: NORMAL.key });
  });

  it('gives want lists no suggestion', async () => {
    const sessionToken = await createSession('want');
    await seedPrice(NORMAL, 200, 220);
    const created = await request(server).post('/api/lists').set(...auth(sessionToken)).send({ kind: 'want', name: 'W' }).expect(201);
    const res = await request(server)
      .post(`/api/lists/${created.body.id}/lines`)
      .set(...auth(sessionToken))
      .send({ cardIdentifier: CARD.cardIdentifier, quantity: 1 })
      .expect(201);
    expect(res.body.lines[0].suggestion).toBeNull();
  });

  it('fills every available line without a price, overwrites chosen lines, and leaves lines without a suggestion alone', async () => {
    const sessionToken = await createSession('apply');
    const listId = await sellList(sessionToken);
    await seedPrice(NORMAL, 200, 220);
    await seedPrice(FOIL, 100, 110);
    const base = { cardIdentifier: CARD.cardIdentifier, quantity: 1 };
    await request(server).post(`/api/lists/${listId}/lines`).set(...auth(sessionToken)).send({ ...base, condition: 'NM' }).expect(201);
    await request(server).post(`/api/lists/${listId}/lines`).set(...auth(sessionToken)).send({ ...base, ...printingVersion(FOIL) }).expect(201);
    await request(server)
      .post(`/api/lists/${listId}/lines`)
      .set(...auth(sessionToken))
      .send({ cardIdentifier: NO_PRICE_CARD.cardIdentifier, quantity: 1, priceCents: 900 })
      .expect(201);
    const soldRes = await request(server)
      .post(`/api/lists/${listId}/lines`)
      .set(...auth(sessionToken))
      .send({ ...base, condition: 'LP' })
      .expect(201);
    const [first, second, third, sold] = soldRes.body.lines as { id: number }[];
    await request(server).patch(`/api/lists/${listId}/lines/${(sold as { id: number }).id}`).set(...auth(sessionToken)).send({ sold: true }).expect(200);

    const subset = await request(server)
      .post(`/api/lists/${listId}/apply-suggestions`)
      .set(...auth(sessionToken))
      .send({ lineIds: [(second as { id: number }).id] })
      .expect(200);
    expect(subset.body.lines.map((line: { priceCents: number | null }) => line.priceCents)).toEqual([null, 700, 900, null]);

    await request(server).patch(`/api/lists/${listId}/lines/${(second as { id: number }).id}`).set(...auth(sessionToken)).send({ priceCents: 1234 }).expect(200);
    const all = await request(server).post(`/api/lists/${listId}/apply-suggestions`).set(...auth(sessionToken)).send({}).expect(200);
    expect(all.body.lines.map((line: { priceCents: number | null }) => line.priceCents)).toEqual([1400, 1234, 900, null]);
    expect((first as { id: number }).id).toBeDefined();
    expect((third as { id: number }).id).toBeDefined();

    await request(server).post(`/api/lists/${listId}/apply-suggestions`).set(...auth(sessionToken)).send({ lineIds: ['x'] }).expect(400);
    await request(server).post(`/api/lists/${listId}/apply-suggestions`).set(...auth(sessionToken)).send({ other: 1 }).expect(400);
  });

  it('keeps prices already written when the multiplier changes, until the seller applies again', async () => {
    const sessionToken = await createSession('stay');
    const listId = await sellList(sessionToken);
    await seedPrice(NORMAL, 200, 220);
    await request(server).post(`/api/lists/${listId}/lines`).set(...auth(sessionToken)).send({ cardIdentifier: CARD.cardIdentifier, quantity: 1 }).expect(201);
    await request(server).post(`/api/lists/${listId}/apply-suggestions`).set(...auth(sessionToken)).send({}).expect(200);
    const changed = await request(server).patch(`/api/lists/${listId}`).set(...auth(sessionToken)).send({ priceMultiplier: 4 }).expect(200);
    expect(changed.body.lines[0]).toMatchObject({ priceCents: 1400 });
    expect(changed.body.lines[0].suggestion.cents).toBe(800);
  });

  it('rejects apply-suggestions for another user as 404', async () => {
    const owner = await createSession('applyowner');
    const stranger = await createSession('applystranger');
    const listId = await sellList(owner);
    const res = await request(server).post(`/api/lists/${listId}/apply-suggestions`).set(...auth(stranger)).send({}).expect(404);
    expect(res.body.code).toBe('CARD_LIST_NOT_FOUND');
  });

  it('puts a suggestion on each printing in the printings route', async () => {
    const sessionToken = await createSession('printings');
    const listId = await sellList(sessionToken);
    await seedPrice(NORMAL, 200, 220);
    await seedPrice(FOIL, null, 150);

    const res = await request(server).get(`/api/lists/${listId}/printings/${CARD.cardIdentifier}`).set(...auth(sessionToken)).expect(200);
    const byKey = new Map((res.body as { printing: string; suggestion: { cents: number; approximate: boolean; printing: string } | null }[]).map((o) => [o.printing, o.suggestion]));
    expect(byKey.get(NORMAL.key)).toMatchObject({ cents: 1400, approximate: false, printing: NORMAL.key });
    expect(byKey.get(FOIL.key)).toMatchObject({ cents: 1100, approximate: true, printing: FOIL.key });

    const want = await request(server).post('/api/lists').set(...auth(sessionToken)).send({ kind: 'want', name: 'W' }).expect(201);
    const wantRes = await request(server).get(`/api/lists/${want.body.id}/printings/${CARD.cardIdentifier}`).set(...auth(sessionToken)).expect(200);
    expect(wantRes.body.every((option: { suggestion: unknown }) => option.suggestion === null)).toBe(true);
  });

  describe('sync pass with a fake tcgcsv client', () => {
    const SET_NAME = NORMAL.set as string;
    const GROUP_ID = 910001;
    const PRODUCT_ID = `${FAKE_PRODUCT_PREFIX}1`;

    function fakeClient(lastUpdated: string, price: number): ITcgcsvClient & { calls: string[] } {
      const calls: string[] = [];
      return {
        calls,
        fetchLastUpdated: async () => {
          calls.push('lastUpdated');
          return new Date(lastUpdated);
        },
        fetchGroups: async () => {
          calls.push('groups');
          return [{ groupId: GROUP_ID, name: SET_NAME, abbreviation: null }];
        },
        fetchPrices: async (groupId) => {
          calls.push(`prices:${groupId}`);
          return [
            { productId: NORMAL.productId as string, subType: printingSubType(NORMAL.foiling, NORMAL.edition) as string, marketPriceCents: price, midPriceCents: price },
            { productId: PRODUCT_ID, subType: 'Normal', marketPriceCents: 1, midPriceCents: null },
          ];
        },
      };
    }

    function fakeClientWithGroups(groupIds: readonly number[], options: { failing?: boolean } = {}): ITcgcsvClient & { calls: string[] } {
      const calls: string[] = [];
      return {
        calls,
        fetchLastUpdated: async () => {
          calls.push('lastUpdated');
          return new Date('2026-10-01T20:05:00Z');
        },
        fetchGroups: async () => {
          calls.push('groups');
          return groupIds.map((groupId) => ({ groupId, name: `Group ${groupId}`, abbreviation: null }));
        },
        fetchPrices: async (groupId) => {
          calls.push(`prices:${groupId}`);
          if (options.failing) throw new Error('tcgcsv is down');
          return [];
        },
      };
    }

    async function marketCents(): Promise<number | null> {
      const rows = (await dataSource.query(
        `SELECT "marketPriceCents" FROM card_price WHERE "productId" = $1 AND "subType" = $2`,
        [NORMAL.productId, printingSubType(NORMAL.foiling, NORMAL.edition)],
      )) as { marketPriceCents: number | null }[];
      return rows[0]?.marketPriceCents ?? null;
    }

    it('reads every group once per UTC day and only after tcgcsv rebuilt', async () => {
      const sessionToken = await createSession('sync');
      const listId = await sellList(sessionToken);
      await dataSource.query(`DELETE FROM card_price WHERE "productId" = $1`, [NORMAL.productId]);
      await dataSource.query(`DELETE FROM card_price_group_sync WHERE "groupId" = $1`, [GROUP_ID]);
      await request(server)
        .post(`/api/lists/${listId}/lines`)
        .set(...auth(sessionToken))
        .send({ cardIdentifier: CARD.cardIdentifier, quantity: 1, ...printingVersion(NORMAL) })
        .expect(201);

      const day1 = new Date('2026-10-18T21:00:00Z');
      const first = fakeClient('2026-10-18T20:05:00Z', 500);
      const report = await new PriceSyncService(dataSource, first).runOnce(day1);
      expect(report.groupsRead).toBe(1);
      expect(first.calls).toEqual(['groups', 'lastUpdated', `prices:${GROUP_ID}`]);
      expect(await marketCents()).toBe(500);

      const sameDay = fakeClient('2026-10-18T20:05:00Z', 999);
      await new PriceSyncService(dataSource, sameDay).runOnce(new Date('2026-10-18T23:00:00Z'));
      expect(sameDay.calls.filter((call) => call.startsWith('prices'))).toEqual([]);
      expect(await marketCents()).toBe(500);

      const notRebuilt = fakeClient('2026-10-18T20:05:00Z', 999);
      await new PriceSyncService(dataSource, notRebuilt).runOnce(new Date('2026-10-19T09:00:00Z'));
      expect(notRebuilt.calls.filter((call) => call.startsWith('prices'))).toEqual([]);

      const rebuilt = fakeClient('2026-10-19T20:05:00Z', 650);
      await new PriceSyncService(dataSource, rebuilt).runOnce(new Date('2026-10-19T21:00:00Z'));
      expect(rebuilt.calls.filter((call) => call.startsWith('prices'))).toEqual([`prices:${GROUP_ID}`]);
      expect(await marketCents()).toBe(650);

      const suggestion = await request(server).get(`/api/lists/${listId}`).set(...auth(sessionToken)).expect(200);
      expect(suggestion.body.lines[0].suggestion).toMatchObject({ cents: 4600, printing: NORMAL.key });
    });

    it('keeps the previous rows and does not throw when tcgcsv fails', async () => {
      await dataSource.query(`DELETE FROM card_price_group_sync WHERE "groupId" = $1`, [GROUP_ID]);
      const before = await marketCents();
      const failing: ITcgcsvClient = {
        fetchLastUpdated: async () => new Date('2026-10-20T20:05:00Z'),
        fetchGroups: async () => [{ groupId: GROUP_ID, name: SET_NAME, abbreviation: null }],
        fetchPrices: async () => {
          throw new Error('tcgcsv is down');
        },
      };

      const report = await new PriceSyncService(dataSource, failing).runOnce(new Date('2026-10-20T21:00:00Z'));

      expect(report).toEqual({ groupsRead: 0, groupsFailed: 1, groupsSkipped: 0 });
      expect(await marketCents()).toBe(before);
      expect(await dataSource.query(`SELECT 1 FROM card_price_group_sync WHERE "groupId" = $1`, [GROUP_ID])).toHaveLength(0);
    });

    it('makes no other call when tcgcsv lists no group', async () => {
      const noGroups = fakeClientWithGroups([]);
      const report = await new PriceSyncService(dataSource, noGroups).runOnce(new Date('2026-10-21T21:00:00Z'));
      expect(report).toEqual({ groupsRead: 0, groupsFailed: 0, groupsSkipped: 0 });
      expect(noGroups.calls).toEqual(['groups']);
    });

    it(`stops the pass after ${MAX_CONSECUTIVE_GROUP_FAILURES} groups fail in a row and reads the rest next time`, async () => {
      const groupIds = [910101, 910102, 910103, 910104, 910105];
      await dataSource.query(`DELETE FROM card_price_group_sync WHERE "groupId" = ANY($1)`, [groupIds]);
      const down = fakeClientWithGroups(groupIds, { failing: true });

      const report = await new PriceSyncService(dataSource, down).runOnce(new Date('2026-10-22T21:00:00Z'));

      expect(report.groupsFailed).toBe(MAX_CONSECUTIVE_GROUP_FAILURES);
      expect(down.calls.filter((call) => call.startsWith('prices'))).toHaveLength(MAX_CONSECUTIVE_GROUP_FAILURES);

      const back = fakeClientWithGroups(groupIds);
      const retry = await new PriceSyncService(dataSource, back).runOnce(new Date('2026-10-22T22:00:00Z'));
      expect(retry.groupsRead).toBe(groupIds.length);
    });

    it('records a group without prices as read, so it is not fetched again that day and the pass goes on', async () => {
      const groupIds = [910301, 910302, 910303];
      await dataSource.query(`DELETE FROM card_price_group_sync WHERE "groupId" = ANY($1)`, [groupIds]);
      const first = fakeClientWithGroups(groupIds);

      const report = await new PriceSyncService(dataSource, first).runOnce(new Date('2026-10-24T21:00:00Z'));
      expect(report.groupsRead).toBe(groupIds.length);

      const later = fakeClientWithGroups(groupIds);
      await new PriceSyncService(dataSource, later).runOnce(new Date('2026-10-24T23:00:00Z'));
      expect(later.calls.filter((call) => call.startsWith('prices'))).toEqual([]);
    });

    it('skips the pass while another process holds the sync lock', async () => {
      const groupIds = [910201];
      await dataSource.query(`DELETE FROM card_price_group_sync WHERE "groupId" = ANY($1)`, [groupIds]);
      const holder = dataSource.createQueryRunner();
      await holder.connect();
      await holder.query('SELECT pg_advisory_lock($1)', [PRICE_SYNC_LOCK_KEY]);
      try {
        const blocked = fakeClientWithGroups(groupIds);
        const report = await new PriceSyncService(dataSource, blocked).runOnce(new Date('2026-10-23T21:00:00Z'));
        expect(report).toEqual({ groupsRead: 0, groupsFailed: 0, groupsSkipped: 0 });
        expect(blocked.calls).toEqual([]);
      } finally {
        await holder.query('SELECT pg_advisory_unlock($1)', [PRICE_SYNC_LOCK_KEY]);
        await holder.release();
      }

      const free = fakeClientWithGroups(groupIds);
      const report = await new PriceSyncService(dataSource, free).runOnce(new Date('2026-10-23T21:00:00Z'));
      expect(report.groupsRead).toBe(1);
    });
  });
});

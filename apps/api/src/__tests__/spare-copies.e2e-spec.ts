/**
 * S20 and S21 over HTTP against the local Postgres: the spare read, the rule and the sell closing line.
 * Needs DATABASE_URL (see `auth/__tests__/accounts-e2e.fixture.ts`).
 */
import request from 'supertest';
import { bootAccountsApp, IAccountsApp } from '../auth/__tests__/accounts-e2e.fixture';
import { sessionCookieHeader, sessionTokenOf } from '../auth/__tests__/session-test-helpers';

const PACK_HUNT = 'pack-hunt-blue';
const SNATCH = 'snatch-red';

interface IUser {
  readonly id: string;
  readonly email: string;
  readonly token: string;
}

interface ISpareBody {
  needsRule: boolean;
  rule: string | null;
  counts: { within_format: number; any_deck: number; per_deck: number };
  totalSpare: number;
  rows: Array<Record<string, unknown> & { cardIdentifier: string; spare: number; finish: string }>;
}

describe('Spare copies (E2E, S20 and S21)', () => {
  let ctx: IAccountsApp;

  beforeAll(async () => {
    ctx = await bootAccountsApp();
  });

  afterAll(async () => {
    await ctx?.close();
    jest.clearAllMocks();
  });

  const server = (): ReturnType<IAccountsApp['app']['getHttpServer']> => ctx.app.getHttpServer();
  const as = (user: IUser): [string, string] => ['Cookie', sessionCookieHeader(user.token)];

  async function signUp(label: string): Promise<IUser> {
    const email = ctx.emailFor(label);
    const response = await request(server()).post('/api/auth/sign-up').send({ email }).expect(201);
    return { id: response.body.user.id as string, email, token: sessionTokenOf(response) };
  }

  async function createDeck(
    user: IUser,
    name: string,
    format: string,
    status: string,
    lines: Array<{ cardIdentifier: string; quantity: number; inventoryQuantity?: number }>,
  ): Promise<number> {
    const [deck] = (await ctx.dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, $2, 'Some Hero', NULL, $3, $4) RETURNING id`,
      [user.id, name, format, status],
    )) as [{ id: number }];
    for (const line of lines) {
      await ctx.dataSource.query(
        `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, "inventoryQuantity", slot) VALUES ($1, $2, $3, $4, 'mainboard')`,
        [deck.id, line.cardIdentifier, line.quantity, line.inventoryQuantity ?? 0],
      );
    }
    return deck.id;
  }

  async function own(user: IUser, cardIdentifier: string, quantity: number, finish = ''): Promise<void> {
    const [existing] = (await ctx.dataSource.query(`SELECT id FROM csv_source WHERE "userId" = $1 AND kind = 'manual'`, [user.id])) as Array<{ id: string }>;
    const sourceId =
      existing?.id ??
      ((await ctx.dataSource.query(`INSERT INTO csv_source ("userId", kind, active) VALUES ($1, 'manual', true) RETURNING id`, [user.id])) as Array<{ id: string }>)[0]!.id;
    await ctx.dataSource.query(
      `INSERT INTO collection_card ("userId", "cardIdentifier", quantity, "sourceId", finish) VALUES ($1, $2, $3, $4, $5)`,
      [user.id, cardIdentifier, quantity, sourceId, finish],
    );
  }

  /** Duda's collection and decks: 6 Pack Hunt (Azul), Kayo CC 3, Rhinar CC 2, Rhinar SA 2 and an Ideia deck with 3. */
  async function sharedScenario(label: string): Promise<{ user: IUser; kayo: number }> {
    const user = await signUp(label);
    await own(user, PACK_HUNT, 6);
    const kayo = await createDeck(user, 'Kayo CC', 'Classic Constructed', 'building', [{ cardIdentifier: PACK_HUNT, quantity: 3 }]);
    await createDeck(user, 'Rhinar CC', 'Classic Constructed', 'ready', [{ cardIdentifier: PACK_HUNT, quantity: 2 }]);
    await createDeck(user, 'Rhinar SA', 'Silver Age', 'active', [{ cardIdentifier: PACK_HUNT, quantity: 2 }]);
    await createDeck(user, 'Dash ideia', 'Classic Constructed', 'idea', [{ cardIdentifier: PACK_HUNT, quantity: 3 }]);
    return { user, kayo };
  }

  const getSpare = async (user: IUser): Promise<ISpareBody> => (await request(server()).get('/api/collection/spare').set(...as(user)).expect(200)).body as ISpareBody;
  const putRule = (user: IUser, rule: unknown): request.Test => request(server()).put('/api/users/me/spare-rule').set(...as(user)).send({ rule });
  const spareOf = (body: ISpareBody, cardIdentifier = PACK_HUNT): number =>
    body.rows.filter((row) => row.cardIdentifier === cardIdentifier).reduce((sum, row) => sum + row.spare, 0);

  async function rowCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of ['collection_card', 'tracked_deck', 'deck_card', 'user']) {
      const [row] = (await ctx.dataSource.query(`SELECT count(*)::int AS n FROM "${table}"`)) as [{ n: number }];
      counts[table] = row.n;
    }
    return counts;
  }

  it('spare copies are computed on each read and never stored', async () => {
    const { user, kayo } = await sharedScenario('computed');
    await putRule(user, 'within_format').expect(200);
    const before = await rowCounts();
    const columnsBefore = await ctx.dataSource.query(`SELECT * FROM "user" WHERE id = $1`, [user.id]);

    const first = await getSpare(user);

    expect(await rowCounts()).toEqual(before);
    expect(await ctx.dataSource.query(`SELECT * FROM "user" WHERE id = $1`, [user.id])).toEqual(columnsBefore);
    expect(spareOf(first)).toBe(1);

    await ctx.dataSource.query(`UPDATE tracked_deck SET status = 'retired' WHERE id = $1`, [kayo]);
    const second = await getSpare(user);
    // Kayo CC no longer holds: Classic Constructed is held by Rhinar CC alone (2) plus Silver Age (2).
    expect(spareOf(second)).toBe(2);
  });

  it('marking an Ideia deck as Montando through the deck route changes the next spare read', async () => {
    const user = await signUp('mark-building');
    await own(user, PACK_HUNT, 6);
    await createDeck(user, 'Kayo CC', 'Classic Constructed', 'building', [{ cardIdentifier: PACK_HUNT, quantity: 3 }]);
    const dash = await createDeck(user, 'Dash ideia', 'Classic Constructed', 'idea', [{ cardIdentifier: PACK_HUNT, quantity: 3 }]);
    await putRule(user, 'per_deck').expect(200);
    expect(spareOf(await getSpare(user))).toBe(3);

    await request(server()).patch(`/api/decks/${dash}`).set(...as(user)).send({ status: 'building' }).expect(200);

    const after = await getSpare(user);
    expect(spareOf(after)).toBe(0);
    expect(after.totalSpare).toBe(0);
  });

  it('asks for the rule only when two holding decks share a card', async () => {
    const { user } = await sharedScenario('asks-rule');

    const asked = await getSpare(user);

    expect(asked.needsRule).toBe(true);
    expect(asked.rule).toBeNull();
    expect(asked.counts).toEqual({ within_format: 1, any_deck: 3, per_deck: 0 });
    expect(asked.rows).toEqual([]);

    const alone = await signUp('asks-rule-alone');
    await own(alone, PACK_HUNT, 6);
    await createDeck(alone, 'Kayo CC', 'Classic Constructed', 'building', [{ cardIdentifier: PACK_HUNT, quantity: 3 }]);
    await createDeck(alone, 'Rhinar CC', 'Classic Constructed', 'ready', [{ cardIdentifier: SNATCH, quantity: 2 }]);

    const settled = await getSpare(alone);

    expect(settled.needsRule).toBe(false);
    expect(settled.rule).toBeNull();
    expect(spareOf(settled)).toBe(3);
  });

  it('answers 401 signed out and one row per card and version', async () => {
    expect((await request(server()).get('/api/collection/spare')).status).toBe(401);
    const user = await signUp('rows');
    await own(user, PACK_HUNT, 1, 'rainbow');
    await own(user, PACK_HUNT, 2, 'none');
    await own(user, SNATCH, 4);

    const body = await getSpare(user);

    expect(body.needsRule).toBe(false);
    expect(body.rows.map((row) => [row.cardIdentifier, row.finish, row.spare])).toEqual([
      [PACK_HUNT, 'rainbow', 1],
      [PACK_HUNT, 'none', 2],
      [SNATCH, '', 4],
    ]);
    for (const row of body.rows) {
      expect(row).toMatchObject({ printingCode: '', edition: '', condition: '' });
      expect(Object.keys(row)).toEqual(expect.arrayContaining(['cardIdentifier', 'printingCode', 'edition', 'finish', 'condition', 'spare']));
    }
  });

  it('stores each of the three rules and refuses anything else', async () => {
    const user = await signUp('rule');
    const stored = async (): Promise<string | null> =>
      ((await ctx.dataSource.query(`SELECT "spareRule" FROM "user" WHERE id = $1`, [user.id])) as Array<{ spareRule: string | null }>)[0]!.spareRule;

    for (const rule of ['within_format', 'any_deck', 'per_deck']) {
      const response = await putRule(user, rule);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ rule });
      expect(await stored()).toBe(rule);
    }

    const sometimes = await putRule(user, 'sometimes');
    const empty = await request(server()).put('/api/users/me/spare-rule').set(...as(user)).send({});
    const nothing = await putRule(user, null);
    expect([sometimes.status, empty.status, nothing.status]).toEqual([400, 400, 400]);
    expect(await stored()).toBe('per_deck');
    expect((await request(server()).put('/api/users/me/spare-rule').send({ rule: 'any_deck' })).status).toBe(401);
  });

  it('a deleted deck holds no copies', async () => {
    const { user, kayo } = await sharedScenario('deleted');
    const without = await signUp('deleted-twin');
    await own(without, PACK_HUNT, 6);
    await createDeck(without, 'Rhinar CC', 'Classic Constructed', 'ready', [{ cardIdentifier: PACK_HUNT, quantity: 2 }]);
    await createDeck(without, 'Rhinar SA', 'Silver Age', 'active', [{ cardIdentifier: PACK_HUNT, quantity: 2 }]);

    const counts = async (who: IUser): Promise<number[]> => {
      const out: number[] = [];
      for (const rule of ['within_format', 'any_deck', 'per_deck']) {
        await putRule(who, rule).expect(200);
        out.push(spareOf(await getSpare(who)));
      }
      return out;
    };
    const withKayo = await counts(user);
    expect(withKayo).toEqual([1, 3, 0]);

    await request(server()).delete(`/api/decks/${kayo}`).set(...as(user)).expect(200);
    expect(await counts(user)).toEqual(await counts(without));

    await request(server()).post(`/api/decks/${kayo}/restore`).set(...as(user)).expect(200);
    expect(await counts(user)).toEqual([1, 3, 0]);
  });

  it('saves the sell closing line up to 140 characters', async () => {
    const user = await signUp('sell-line');
    const stored = async (): Promise<string | null> =>
      ((await ctx.dataSource.query(`SELECT "sellClosingLine" FROM "user" WHERE id = $1`, [user.id])) as Array<{ sellClosingLine: string | null }>)[0]!.sellClosingLine;

    const saved = await request(server()).patch('/api/users/me/sell-closing-line').set(...as(user)).send({ text: 'Aceito PIX' });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ text: 'Aceito PIX' });
    expect(await stored()).toBe('Aceito PIX');

    const tooLong = await request(server()).patch('/api/users/me/sell-closing-line').set(...as(user)).send({ text: 'y'.repeat(141) });
    expect(tooLong.status).toBe(400);
    expect(await stored()).toBe('Aceito PIX');

    const me = await request(server()).get('/api/auth/me').set(...as(user)).expect(200);
    expect(me.body.sellClosingLine).toBe('Aceito PIX');
    expect((await request(server()).patch('/api/users/me/sell-closing-line').send({ text: 'oi' })).status).toBe(401);
  });
});

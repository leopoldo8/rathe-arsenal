import { Logger } from '@nestjs/common';
import { IFixture, bootFixture, COAX, EMISSARY } from '../../replacements/__tests__/replacements-e2e.fixture';
import { HousekeepingService, HOUSEKEEPING_LOCK_KEY } from '../housekeeping.service';

const DAY = "interval '1 day'";
// Codes are keyed by address and an unconsumed one is unique per address, so a rerun must not reuse an address.
const RUN = Date.now().toString(36);

describe('housekeeping (E2E)', () => {
  let fixture: IFixture;
  let housekeeping: HousekeepingService;

  beforeAll(async () => {
    fixture = await bootFixture();
    housekeeping = fixture.app.get(HousekeepingService);
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  // The suite shares one database: what earlier files left behind is cleared first, so the counts below are exact.
  beforeEach(async () => {
    await housekeeping.tick();
  });

  async function userId(email: string): Promise<string> {
    const [row] = await fixture.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    return row.id as string;
  }

  async function count(table: string, where: string, params: unknown[]): Promise<number> {
    const [row] = await fixture.dataSource.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`, params);
    return row.count as number;
  }

  async function markUserDeleted(email: string, daysAgo: number): Promise<void> {
    await fixture.dataSource.query(`UPDATE "user" SET "deletedAt" = now() - ${DAY} * $2 WHERE email = $1`, [email, daysAgo]);
  }

  async function markDeckDeleted(deckId: number, daysAgo: number): Promise<void> {
    await fixture.dataSource.query(`UPDATE tracked_deck SET "deletedAt" = now() - ${DAY} * $2 WHERE id = $1`, [deckId, daysAgo]);
  }

  async function addCode(email: string, state: 'live' | 'consumed' | 'expired', ageHours: number): Promise<string> {
    const [row] = await fixture.dataSource.query(
      `INSERT INTO sign_in_code (email, "codeHash", "buttonTokenHash", "expiresAt", "consumedAt", "createdAt")
       VALUES ($1, md5(random()::text), md5(random()::text) || md5(random()::text),
         now() + CASE WHEN $2 = 'expired' THEN interval '-5 minutes' ELSE interval '10 minutes' END,
         CASE WHEN $2 = 'consumed' THEN now() - interval '30 minutes' ELSE NULL END,
         now() - interval '1 hour' * $3)
       RETURNING id`,
      [email, state, ageHours],
    );
    return row.id as string;
  }

  /** A user with a deck, copies, a list with a line, a pending line, a session and a sign-in code. */
  async function fullUser(label: string): Promise<{ email: string; id: string; deckId: number; codeId: string }> {
    const owner = await fixture.scenario();
    await fixture.own(owner.sessionToken, [{ cardIdentifier: COAX, quantity: 2 }]);
    const list = await fixture.post('/api/lists', owner.sessionToken).send({ kind: 'want', name: `Lista ${label}` }).expect(201);
    await fixture.post(`/api/lists/${list.body.id}/lines`, owner.sessionToken).send({ cardIdentifier: EMISSARY, quantity: 1 }).expect(201);
    const id = await userId(owner.email);
    const [source] = await fixture.dataSource.query(`SELECT id FROM csv_source WHERE "userId" = $1 LIMIT 1`, [id]);
    await fixture.dataSource.query(
      `INSERT INTO import_pending_line ("sourceId", "userId", "lineNumber", "originalText", reason) VALUES ($1, $2, 1, 'Snatch', 'asks_color')`,
      [source.id, id],
    );
    const codeId = await addCode(owner.email, 'live', 2);
    return { email: owner.email, id, deckId: owner.deckId, codeId };
  }

  async function rowsOf(user: { id: string; deckId: number; codeId: string; email: string }): Promise<Record<string, number>> {
    return {
      user: await count('"user"', 'id = $1', [user.id]),
      imports: await count('csv_source', '"userId" = $1', [user.id]),
      pending: await count('import_pending_line', '"userId" = $1', [user.id]),
      copies: await count('collection_card', '"userId" = $1', [user.id]),
      lists: await count('card_list', '"userId" = $1', [user.id]),
      listLines: await count('card_list_line', '"listId" IN (SELECT id FROM card_list WHERE "userId" = $1)', [user.id]),
      decks: await count('tracked_deck', '"userId" = $1', [user.id]),
      deckLines: await count('deck_card', '"trackedDeckId" = $1', [user.deckId]),
      sessions: await count('user_session', '"userId" = $1', [user.id]),
      codes: await count('sign_in_code', 'id = $1', [user.codeId]),
    };
  }

  it('one tick removes what is 30 days gone and what has ended', async () => {
    const gone = await fullUser('gone');
    const recent = await fullUser('recent');
    await markUserDeleted(gone.email, 31);
    await markUserDeleted(recent.email, 29);

    const deckOwner = await fixture.scenario();
    const secondDeck = await fixture.scenario();
    const goneDeckId = deckOwner.deckId;
    const keptDeckId = secondDeck.deckId;
    await markDeckDeleted(goneDeckId, 31);
    await markDeckDeleted(keptDeckId, 29);

    const consumed = await addCode(`consumed-${RUN}@test.local`, 'consumed', 2);
    const expired = await addCode(`expired-${RUN}@test.local`, 'expired', 2);
    const live = await addCode(`live-${RUN}@test.local`, 'live', 2);
    const revoker = await fixture.signUp('revoker');
    const revokerId = await userId(revoker.email);
    const [liveSession] = await fixture.dataSource.query(`SELECT id FROM user_session WHERE "userId" = $1`, [revokerId]);
    const [endedSession] = await fixture.dataSource.query(
      `INSERT INTO user_session ("userId", "tokenHash", "revokedAt") VALUES ($1, md5(random()::text) || md5(random()::text), now()) RETURNING id`,
      [revokerId],
    );

    const result = await housekeeping.tick();

    expect(result.ran).toBe(true);
    expect(Object.values(await rowsOf(gone)).every((rows) => rows === 0)).toBe(true);
    expect(await rowsOf(recent)).toEqual({ user: 1, imports: 1, pending: 1, copies: 1, lists: 1, listLines: 1, decks: 1, deckLines: expect.any(Number), sessions: expect.any(Number), codes: 1 });
    expect((await rowsOf(recent))['sessions']).toBeGreaterThan(0);
    expect((await rowsOf(recent))['deckLines']).toBeGreaterThan(0);
    expect(await count('tracked_deck', 'id = $1', [goneDeckId])).toBe(0);
    expect(await count('deck_card', '"trackedDeckId" = $1', [goneDeckId])).toBe(0);
    expect(await count('tracked_deck', 'id = $1', [keptDeckId])).toBe(1);
    expect(await count('sign_in_code', 'id = ANY($1::uuid[])', [[consumed, expired]])).toBe(0);
    expect(await count('sign_in_code', 'id = $1', [live])).toBe(1);
    expect(await count('user_session', 'id = $1', [endedSession.id])).toBe(0);
    expect(await count('user_session', 'id = $1', [liveSession.id])).toBe(1);
  });

  it('keeps a spent sign-in code for an hour, because the limit of five an hour counts it', async () => {
    const young = await addCode(`young-spent-${RUN}@test.local`, 'consumed', 0.5);
    const youngExpired = await addCode(`young-expired-${RUN}@test.local`, 'expired', 0.5);
    const old = await addCode(`old-spent-${RUN}@test.local`, 'consumed', 1.5);

    await housekeeping.tick();

    expect(await count('sign_in_code', 'id = ANY($1::uuid[])', [[young, youngExpired]])).toBe(2);
    expect(await count('sign_in_code', 'id = $1', [old])).toBe(0);
  });

  it('two workers at once delete each row once', async () => {
    const deckUser = await fixture.scenario();
    const deckUser2 = await fixture.scenario();
    await markDeckDeleted(deckUser.deckId, 31);
    await markDeckDeleted(deckUser2.deckId, 40);
    const gone = await fixture.signUp('gone-race');
    const gone2 = await fixture.signUp('gone-race-2');
    await markUserDeleted(gone.email, 35);
    await markUserDeleted(gone2.email, 35);
    await addCode(`race-1-${RUN}@test.local`, 'consumed', 3);
    await addCode(`race-2-${RUN}@test.local`, 'expired', 3);
    const racer = await fixture.signUp('racer');
    const racerId = await userId(racer.email);
    for (let index = 0; index < 2; index += 1) {
      await fixture.dataSource.query(
        `INSERT INTO user_session ("userId", "tokenHash", "revokedAt") VALUES ($1, md5(random()::text) || md5(random()::text), now())`,
        [racerId],
      );
    }
    const logged: unknown[] = [];
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      if ((message as { event?: string })?.event === 'housekeeping.tick') logged.push(message);
    });

    const results = await Promise.all([housekeeping.tick(), housekeeping.tick()]);
    spy.mockRestore();

    const total = (counts: { users: number; decks: number; signInCodes: number; sessions: number }): number =>
      counts.users + counts.decks + counts.signInCodes + counts.sessions;
    // 2 users, 2 decks, 2 codes and 2 revoked sessions were seeded, and a second pass finds nothing left.
    expect(results.reduce((sum, result) => sum + total(result.deleted), 0)).toBe(8);
    expect(logged).toHaveLength(2);
    const loggedTotal = (logged as Array<{ deleted: Parameters<typeof total>[0] }>).reduce((sum, entry) => sum + total(entry.deleted), 0);
    expect(loggedTotal).toBe(8);
  });

  it('the tick that does not get the lock deletes nothing and throws nothing', async () => {
    const gone = await fixture.signUp('locked-out');
    await markUserDeleted(gone.email, 45);
    const holder = fixture.dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    await holder.query('SELECT pg_advisory_xact_lock($1)', [HOUSEKEEPING_LOCK_KEY]);

    try {
      await expect(housekeeping.tick()).resolves.toEqual({
        ran: false,
        deleted: { users: 0, decks: 0, signInCodes: 0, sessions: 0 },
      });
      expect(await count('"user"', 'email = $1', [gone.email])).toBe(1);
    } finally {
      await holder.rollbackTransaction();
      await holder.release();
    }
    await housekeeping.tick();
    expect(await count('"user"', 'email = $1', [gone.email])).toBe(0);
  });

  it('a deck deleted 31 days ago is gone after one tick', async () => {
    const owner = await fixture.scenario();
    await markDeckDeleted(owner.deckId, 31);

    await housekeeping.tick();

    expect(await count('tracked_deck', 'id = $1', [owner.deckId])).toBe(0);
  });

  it('deletes decks soft-deleted 30 days ago', async () => {
    const stale = await fixture.scenario();
    const fresh = await fixture.scenario();
    await fixture.dataSource.query(`UPDATE "user" SET "displayName" = 'Dono' WHERE email = $1`, [stale.email]);
    await fixture.post(`/api/decks/${stale.deckId}/share`, stale.sessionToken).send({ intent: 'deck' }).expect(201);
    expect(await count('share_link', '"targetKind" = \'deck\' AND "targetId" = $1', [stale.deckId])).toBe(1);
    await fixture.dataSource.query(
      `UPDATE tracked_deck SET "deletedAt" = now() - interval '30 days' - interval '1 minute' WHERE id = $1`,
      [stale.deckId],
    );
    await markDeckDeleted(fresh.deckId, 29);

    await housekeeping.tick();

    expect(await count('tracked_deck', 'id = $1', [stale.deckId])).toBe(0);
    expect(await count('deck_card', '"trackedDeckId" = $1', [stale.deckId])).toBe(0);
    expect(await count('deck_readiness_snapshot', '"trackedDeckId" = $1', [stale.deckId])).toBe(0);
    expect(await count('tracked_deck', 'id = $1', [fresh.deckId])).toBe(1);
    expect(await count('deck_card', '"trackedDeckId" = $1', [fresh.deckId])).toBeGreaterThan(0);
    expect(await count('share_link', '"targetKind" = \'deck\' AND "targetId" = $1', [stale.deckId])).toBe(0);
  });
});

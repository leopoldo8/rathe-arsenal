import { Logger } from '@nestjs/common';
import { computeDeckFingerprint } from '../recommendation-prompt';
import { RecommendationQueueService } from '../recommendation-queue.service';
import { TGeminiFetch } from '../gemini-client';
import {
  bootRecommendationsFixture,
  EMISSARY,
  FLEX,
  geminiBody,
  IRecommendationsFixture,
  promptOf,
  stubFetch,
} from './recommendations-e2e.fixture';

const POOL = [
  'ancestral-harmony-blue',
  'art-of-the-dragon-blood-red',
  'art-of-the-dragon-claw-red',
  'adrenaline-rush-red',
  'adrenaline-rush-yellow',
  'adrenaline-rush-blue',
  'amethyst-amulet-blue',
  'deathmatch-arena',
  'authority-of-ataya-blue',
  'arcane-lantern',
  'arcanite-fortress',
] as const;

describe('recommendation worker (e2e)', () => {
  let fixture: IRecommendationsFixture;
  let queue: RecommendationQueueService;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture();
    queue = fixture.app.get(RecommendationQueueService);
  });

  beforeEach(async () => {
    await fixture.dataSource.query(`DELETE FROM recommendation_run WHERE status IN ('pending', 'running')`);
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function deckWithManualRun(): Promise<{ jwt: string; deckId: number; runId: string }> {
    const scenario = await fixture.scenario();
    await fixture.clearRuns(scenario.deckId);
    const runId = await fixture.seedRun(scenario.deckId, 'pending', { trigger: 'manual' });
    return { ...scenario, runId };
  }

  async function run(runId: string) {
    const [row] = await fixture.dataSource.query(`SELECT * FROM recommendation_run WHERE id = $1`, [runId]);
    return row;
  }

  async function recommendationRows(runId: string) {
    return fixture.dataSource.query(`SELECT * FROM recommendation WHERE "runId" = $1 ORDER BY rank`, [runId]);
  }

  async function secondsUntil(runId: string): Promise<number> {
    return fixture.secondsUntilRunAfter(runId);
  }

  it('claims only due runs of decks with nothing running', async () => {
    const due = await deckWithManualRun();
    const future = await deckWithManualRun();
    await fixture.dataSource.query(`UPDATE recommendation_run SET "runAfter" = now() + interval '1 minute' WHERE id = $1`, [future.runId]);
    const busy = await deckWithManualRun();
    await fixture.seedRun(busy.deckId, 'running', { claimedMinutesAgo: 0 });
    await fixture.dataSource.query(`UPDATE recommendation_run SET "runAfter" = now() - interval '1 hour' WHERE id = $1`, [busy.runId]);

    const claimed = await queue.claimNext();

    expect(claimed?.id).toBe(due.runId);
    const row = await run(due.runId);
    expect(row).toEqual(expect.objectContaining({ status: 'running', attempts: 1 }));
    expect(row.startedAt).not.toBeNull();
    expect(row.claimedAt).not.toBeNull();
    expect(await queue.claimNext()).toBeNull();
    expect((await run(future.runId)).status).toBe('pending');
    expect((await run(busy.runId)).status).toBe('pending');
  });

  it('an auto run of a retired deck fails without a call', async () => {
    const { deckId, runId } = await deckWithManualRun();
    await fixture.dataSource.query(`UPDATE recommendation_run SET "trigger" = 'auto' WHERE id = $1`, [runId]);
    await fixture.dataSource.query(`UPDATE tracked_deck SET status = 'retired' WHERE id = $1`, [deckId]);
    const stub = stubFetch(200, geminiBody([{ card: POOL[0] }]));

    await fixture.drain(stub.fetch);

    expect(await run(runId)).toEqual(expect.objectContaining({ status: 'failed', error: 'DECK_RETIRED' }));
    expect(stub.calls).toHaveLength(0);

    const manual = await fixture.seedRun(deckId, 'pending', { trigger: 'manual' });
    await fixture.drain(stub.fetch);
    expect(stub.calls).toHaveLength(1);
    expect((await run(manual)).status).toBe('done');
  });

  it('a deck without a hero fails without a call', async () => {
    const { deckId, runId } = await deckWithManualRun();
    await fixture.dataSource.query(`UPDATE tracked_deck SET "heroIdentifier" = NULL WHERE id = $1`, [deckId]);
    const stub = stubFetch(200, geminiBody([{ card: POOL[0] }]));

    await fixture.drain(stub.fetch);

    expect(await run(runId)).toEqual(expect.objectContaining({ status: 'failed', error: 'DECK_INVALID' }));
    expect(stub.calls).toHaveLength(0);
  });

  it('the request leaves out dismissed and deck cards', async () => {
    const { jwt, deckId } = await deckWithManualRun();
    await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: POOL[3] }).expect(201);
    const stub = stubFetch(200, geminiBody([{ card: POOL[0] }]));

    await fixture.drain(stub.fetch);

    const poolSection = promptOf(stub).split('Candidate pool')[1]!;
    const poolIds = poolSection.split('\n').slice(1).map((line) => line.split(' | ')[0]);
    expect(poolIds).toContain(POOL[0]);
    expect(poolIds).not.toContain(POOL[3]);
    expect(poolIds).not.toContain(EMISSARY);
    expect(poolIds).not.toContain(FLEX);
  });

  it('a missing key fails without a call', async () => {
    for (const apiKey of [null, '  ']) {
      const { runId } = await deckWithManualRun();
      const stub = stubFetch(200, geminiBody([{ card: POOL[0] }]));

      await fixture.drain(stub.fetch, apiKey);

      expect({ apiKey, run: await run(runId) }).toEqual({
        apiKey,
        run: expect.objectContaining({ status: 'failed', error: 'NO_API_KEY' }),
      });
      expect(stub.calls).toHaveLength(0);
    }
  });

  it('a valid answer stores ranked recommendations and usage', async () => {
    const { deckId, runId } = await deckWithManualRun();
    const entries = [
      { card: POOL[0], strength: 'clear_upgrade', cut: FLEX },
      { card: 'not-a-card' },
      { card: POOL[1] },
      { card: POOL[0] },
      { card: POOL[2], strength: 'great' },
      { card: EMISSARY },
      ...POOL.slice(3).map((card) => ({ card })),
    ];
    const stub = stubFetch(200, geminiBody(entries));

    await fixture.drain(stub.fetch);

    const row = await run(runId);
    const deckCards = await fixture.dataSource.query(`SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1`, [deckId]);
    expect(row).toEqual(
      expect.objectContaining({
        status: 'done',
        model: 'gemini-3.8-flash',
        inputTokens: 41000,
        outputTokens: 3000,
        error: null,
        deckFingerprint: computeDeckFingerprint({ heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed', cards: deckCards }),
      }),
    );
    expect(row.deckFingerprint).toMatch(/^[0-9a-f]{64}$/);
    const rows = await recommendationRows(runId);
    expect(rows.map((r: { rank: number; cardIdentifier: string }) => [r.rank, r.cardIdentifier])).toEqual([
      [1, POOL[0]],
      [2, POOL[1]],
      ...POOL.slice(3).map((card, index) => [index + 3, card]),
    ]);
    expect(rows[0]).toEqual(expect.objectContaining({ strength: 'clear_upgrade', cutCardIdentifier: FLEX, cutSlot: 'mainboard' }));
  });

  it('an answer with nothing valid ends done and empty', async () => {
    const { runId } = await deckWithManualRun();

    await fixture.drain(stubFetch(200, geminiBody([{ card: EMISSARY }, { card: 'nope' }])).fetch);

    expect((await run(runId)).status).toBe('done');
    expect(await recommendationRows(runId)).toEqual([]);
  });

  async function backsOffThenFails(status: number, code: string): Promise<void> {
    const { deckId, runId } = await deckWithManualRun();
    const stub = stubFetch(status);

    await fixture.drain(stub.fetch);
    expect(await run(runId)).toEqual(expect.objectContaining({ status: 'pending', attempts: 1 }));
    const first = await secondsUntil(runId);
    expect(first).toBeGreaterThan(58);
    expect(first).toBeLessThanOrEqual(60);

    await fixture.makeDue(deckId);
    await fixture.drain(stub.fetch);
    expect(await run(runId)).toEqual(expect.objectContaining({ status: 'pending', attempts: 2 }));
    const second = await secondsUntil(runId);
    expect(second).toBeGreaterThan(118);
    expect(second).toBeLessThanOrEqual(120);

    await fixture.makeDue(deckId);
    await fixture.drain(stub.fetch);
    expect(await run(runId)).toEqual(expect.objectContaining({ status: 'failed', attempts: 3, error: code }));
    expect(stub.calls).toHaveLength(3);
  }

  it('a 429 backs off twice then fails RATE_LIMITED', async () => {
    await backsOffThenFails(429, 'RATE_LIMITED');
  });

  it('a 503 backs off then fails PROVIDER_UNAVAILABLE', async () => {
    await backsOffThenFails(503, 'PROVIDER_UNAVAILABLE');
  });

  it('a refusal fails the run and keeps the earlier list', async () => {
    const { deckId } = await deckWithManualRun();
    await fixture.dataSource.query(`DELETE FROM recommendation_run WHERE "trackedDeckId" = $1`, [deckId]);
    const earlier = await fixture.seedDoneRun(deckId, POOL.slice(0, 10).map((card) => ({ card })));
    const pendingId = await fixture.seedRun(deckId, 'pending', { trigger: 'manual' });

    await fixture.drain(stubFetch(200, geminiBody([{ card: POOL[0] }], 'SAFETY')).fetch);

    expect(await run(pendingId)).toEqual(expect.objectContaining({ status: 'failed', error: 'MODEL_REFUSED' }));
    expect((await run(earlier.runId)).status).toBe('done');
    expect((await recommendationRows(earlier.runId)).map((row: { id: string }) => row.id)).toEqual(earlier.ids);
  });

  it('reclaims orphans after 10 minutes', async () => {
    const lone = (await fixture.scenario()).deckId;
    await fixture.clearRuns(lone);
    const orphan = await fixture.seedRun(lone, 'running', { claimedMinutesAgo: 11 });
    const crowded = (await fixture.scenario()).deckId;
    await fixture.clearRuns(crowded);
    const crowdedOrphan = await fixture.seedRun(crowded, 'running', { claimedMinutesAgo: 11 });
    await fixture.seedRun(crowded, 'pending');
    const fresh = (await fixture.scenario()).deckId;
    await fixture.clearRuns(fresh);
    const recent = await fixture.seedRun(fresh, 'running', { claimedMinutesAgo: 9 });

    await queue.reclaimOrphans();

    expect(await run(orphan)).toEqual(expect.objectContaining({ status: 'pending', claimedAt: null }));
    expect(await run(crowdedOrphan)).toEqual(expect.objectContaining({ status: 'failed', error: 'WORKER_LOST' }));
    expect((await run(recent)).status).toBe('running');
  });

  it('a retry behind a newer pending run is superseded', async () => {
    for (const [trigger, expectedSeconds] of [['manual', 60], ['auto', 300]] as const) {
      const { deckId, runId } = await deckWithManualRun();
      let newerId = '';
      const fetch: TGeminiFetch = async () => {
        newerId = await fixture.seedRun(deckId, 'pending', { trigger });
        if (trigger === 'auto') {
          await fixture.dataSource.query(`UPDATE recommendation_run SET "runAfter" = clock_timestamp() + interval '300 seconds' WHERE id = $1`, [newerId]);
        }
        return { ok: false, status: 429, json: async () => ({}) };
      };

      await fixture.drain(fetch);

      expect({ trigger, run: await run(runId) }).toEqual({
        trigger,
        run: expect.objectContaining({ status: 'failed', error: 'SUPERSEDED' }),
      });
      const seconds = await secondsUntil(newerId);
      expect({ trigger, near: Math.abs(seconds - expectedSeconds) < 2 }).toEqual({ trigger, near: true });
    }
  });

  it('logs each run transition', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    const warn = jest.spyOn(Logger.prototype, 'warn');
    try {
      const done = await deckWithManualRun();
      await fixture.drain(stubFetch(200, geminiBody([{ card: POOL[0], strength: 'clear_upgrade' }, { card: 'nope' }])).fetch);
      expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'recommendations.run.claimed', trackedDeckId: done.deckId, runId: done.runId }));
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'recommendations.run.done',
          trackedDeckId: done.deckId,
          runId: done.runId,
          kept: 1,
          dropped: 1,
          clearUpgrades: 1,
          inputTokens: 41000,
          outputTokens: 3000,
          durationMs: expect.any(Number),
        }),
      );

      const retried = await deckWithManualRun();
      await fixture.drain(stubFetch(429).fetch);
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'recommendations.run.retry', runId: retried.runId, status: 429, runAfter: expect.any(String) }),
      );

      const refused = await deckWithManualRun();
      await fixture.drain(stubFetch(200, geminiBody([], 'SAFETY')).fetch);
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'recommendations.run.failed', runId: refused.runId, code: 'MODEL_REFUSED', attempts: 1 }),
      );
    } finally {
      log.mockRestore();
      warn.mockRestore();
    }
  });
});

import { Logger } from '@nestjs/common';
import {
  bootRecommendationsFixture,
  COAX,
  EMISSARY,
  FLEX,
  IRecommendationsFixture,
  KATSU,
  TALISHAR,
} from './recommendations-e2e.fixture';

const ADRENALINE = 'adrenaline-rush-red';

function composition(flexCopies = 2): object {
  return {
    heroIdentifier: KATSU,
    format: 'Classic Constructed',
    cards: [
      { cardIdentifier: KATSU, quantity: 1, slot: 'hero' },
      { cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
      { cardIdentifier: FLEX, quantity: flexCopies, slot: 'mainboard' },
      { cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' },
    ],
  };
}

describe('recommendation queue (e2e)', () => {
  let fixture: IRecommendationsFixture;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture();
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function freshDeck(): Promise<{ jwt: string; deckId: number }> {
    const scenario = await fixture.scenario();
    await fixture.clearRuns(scenario.deckId);
    return scenario;
  }

  async function pendingRuns(deckId: number) {
    return (await fixture.runs(deckId)).filter((run) => run.status === 'pending');
  }

  it('a composition save leaves one pending auto run due in 5 minutes', async () => {
    const { jwt, deckId } = await freshDeck();

    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);

    const runs = await fixture.runs(deckId);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual(expect.objectContaining({ status: 'pending', trigger: 'auto' }));
    const seconds = await fixture.secondsUntilRunAfter(runs[0]!.id);
    expect(seconds).toBeGreaterThan(298);
    expect(seconds).toBeLessThanOrEqual(300);
  });

  it('a second change pushes the pending auto run back', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);
    const [first] = await fixture.runs(deckId);
    await fixture.dataSource.query(`UPDATE recommendation_run SET "runAfter" = "runAfter" - interval '10 seconds' WHERE id = $1`, [first!.id]);

    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(2)).expect(200);

    const runs = await fixture.runs(deckId);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.id).toBe(first!.id);
    const pushed = await fixture.secondsUntilRunAfter(first!.id);
    expect(pushed).toBeGreaterThan(298);
    expect(pushed).toBeLessThanOrEqual(300);
  });

  it('a change leaves a pending manual run alone', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.post(`/api/decks/${deckId}/recommendations/runs`, jwt).expect(202);
    const [manual] = await fixture.runs(deckId);

    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);

    const runs = await fixture.runs(deckId);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual(expect.objectContaining({ id: manual!.id, trigger: 'manual' }));
    expect(new Date(runs[0]!.runAfter).getTime()).toBe(new Date(manual!.runAfter).getTime());
  });

  it('every deck-list writer enqueues an auto run', async () => {
    const writers: ReadonlyArray<[string, () => Promise<number[]>]> = [
      ['composition save', async () => {
        const { jwt, deckId } = await freshDeck();
        await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);
        return [deckId];
      }],
      ['deck import', async () => {
        const { jwt } = await fixture.signUp('import');
        const deckIds = await fixture.importDecks(jwt, 2);
        expect(deckIds).toHaveLength(2);
        return deckIds;
      }],
      ['pick', async () => {
        const { jwt, deckId } = await freshDeck();
        await fixture
          .post(`/api/decks/${deckId}/replacements`, jwt)
          .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'search' })
          .expect(201);
        return [deckId];
      }],
      ['revert', async () => {
        const { jwt, deckId } = await freshDeck();
        const picked = await fixture
          .post(`/api/decks/${deckId}/replacements`, jwt)
          .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'search' })
          .expect(201);
        await fixture.clearRuns(deckId);
        await fixture.post(`/api/replacements/${picked.body.replacement.id}/revert`, jwt).expect(200);
        return [deckId];
      }],
      ['adopt', async () => {
        const { jwt, deckId } = await freshDeck();
        const { ids: seeded } = await fixture.seedDoneRun(deckId, [{ card: ADRENALINE, cut: FLEX }]);
        await fixture
          .post(`/api/decks/${deckId}/recommendations/${seeded[0]}/adopt`, jwt)
          .send({ cutCardIdentifier: FLEX, cutSlot: 'mainboard' })
          .expect(201);
        return [deckId];
      }],
      ['format PATCH', async () => {
        const { jwt, deckId } = await freshDeck();
        await fixture.patch(`/api/decks/${deckId}`, jwt).send({ format: 'Blitz' }).expect(200);
        return [deckId];
      }],
    ];

    for (const [label, write] of writers) {
      const deckIds = await write();
      for (const deckId of deckIds) {
        const pending = await pendingRuns(deckId);
        expect({ label, deckId, pending: pending.map((run) => run.trigger) }).toEqual({ label, deckId, pending: ['auto'] });
      }
    }
  });

  it('non-writers enqueue nothing', async () => {
    const { jwt, deckId } = await freshDeck();
    const picked = await fixture
      .post(`/api/decks/${deckId}/replacements`, jwt)
      .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'search' })
      .expect(201);
    await fixture.clearRuns(deckId);

    const nonWriters: ReadonlyArray<[string, () => Promise<void>]> = [
      ['keep', async () => {
        await fixture.post(`/api/replacements/${picked.body.replacement.id}/keep`, jwt).expect(200);
      }],
      ['mark-owned', async () => {
        await fixture.own(jwt, [{ cardIdentifier: FLEX, quantity: 2 }]);
      }],
      ['name-only PATCH', async () => {
        await fixture.patch(`/api/decks/${deckId}`, jwt).send({ name: 'Renamed' }).expect(200);
      }],
      ['same-format PATCH', async () => {
        await fixture.patch(`/api/decks/${deckId}`, jwt).send({ format: 'Classic Constructed' }).expect(200);
      }],
    ];
    for (const [label, act] of nonWriters) {
      await act();
      expect({ label, runs: (await fixture.runs(deckId)).length }).toEqual({ label, runs: 0 });
    }

    const scratch = await fixture
      .post('/api/decks', jwt)
      .send({ heroIdentifier: KATSU, format: 'Classic Constructed' })
      .expect(201);
    expect({ label: 'scratch create', runs: (await fixture.runs(scratch.body.id)).length }).toEqual({
      label: 'scratch create',
      runs: 0,
    });
  });

  it('a change while a run is running queues an auto run behind it', async () => {
    const { jwt, deckId } = await freshDeck();
    const runningId = await fixture.seedRun(deckId, 'running', { claimedMinutesAgo: 0 });

    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);

    const runs = await fixture.runs(deckId);
    expect(runs.map((run) => [run.status, run.trigger])).toEqual([
      ['running', 'manual'],
      ['pending', 'auto'],
    ]);
    expect(runs[0]!.id).toBe(runningId);
  });

  it('a retired deck gets no automatic run', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.patch(`/api/decks/${deckId}`, jwt).send({ status: 'retired' }).expect(200);

    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);

    expect(await fixture.runs(deckId)).toHaveLength(0);
  });

  it('concurrent changes leave one pending run', async () => {
    const { jwt, deckId } = await freshDeck();

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) => fixture.put(`/api/decks/${deckId}`, jwt).send(composition(1 + (index % 3)))),
    );

    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(200));
    expect(await pendingRuns(deckId)).toHaveLength(1);
    expect(await fixture.runs(deckId)).toHaveLength(1);
  });

  it('Generate creates a manual run due now', async () => {
    const { jwt, deckId } = await freshDeck();

    const response = await fixture.post(`/api/decks/${deckId}/recommendations/runs`, jwt).expect(202);

    const runs = await fixture.runs(deckId);
    expect(runs).toHaveLength(1);
    expect(response.body.run).toEqual({
      id: runs[0]!.id,
      status: 'pending',
      trigger: 'manual',
      createdAt: new Date(runs[0]!.createdAt).toISOString(),
    });
    const seconds = await fixture.secondsUntilRunAfter(runs[0]!.id);
    expect(seconds).toBeLessThanOrEqual(0);
    expect(seconds).toBeGreaterThan(-1);
  });

  it('Generate promotes the pending auto run', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);
    const [auto] = await fixture.runs(deckId);

    const response = await fixture.post(`/api/decks/${deckId}/recommendations/runs`, jwt).expect(202);

    expect(response.body.run).toEqual(expect.objectContaining({ id: auto!.id, trigger: 'manual', status: 'pending' }));
    const runs = await fixture.runs(deckId);
    expect(runs).toHaveLength(1);
    expect(await fixture.secondsUntilRunAfter(auto!.id)).toBeLessThanOrEqual(0);
  });

  it('Generate returns the running run', async () => {
    const { jwt, deckId } = await freshDeck();
    const runningId = await fixture.seedRun(deckId, 'running', { claimedMinutesAgo: 0 });

    const response = await fixture.post(`/api/decks/${deckId}/recommendations/runs`, jwt).expect(202);

    expect(response.body.run).toEqual(expect.objectContaining({ id: runningId, status: 'running' }));
    expect(await fixture.runs(deckId)).toHaveLength(1);
  });

  it('Generate refuses foreign, missing and malformed decks', async () => {
    const { deckId } = await freshDeck();
    const stranger = await fixture.signUp('stranger');

    await fixture.post(`/api/decks/${deckId}/recommendations/runs`, stranger.jwt).expect(404);
    await fixture.post(`/api/decks/2147483000/recommendations/runs`, stranger.jwt).expect(404);
    await fixture.post(`/api/decks/abc/recommendations/runs`, stranger.jwt).expect(400);
    await fixture.post(`/api/decks/${deckId}/recommendations/runs`, '').expect(401);
    expect(await fixture.runs(deckId)).toHaveLength(0);
  });

  it('logs the enqueue', async () => {
    const { jwt, deckId } = await freshDeck();
    const log = jest.spyOn(Logger.prototype, 'log');
    try {
      await fixture.put(`/api/decks/${deckId}`, jwt).send(composition(3)).expect(200);

      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'recommendations.enqueued', trackedDeckId: deckId, trigger: 'auto' }),
      );
    } finally {
      log.mockRestore();
    }
  });
});

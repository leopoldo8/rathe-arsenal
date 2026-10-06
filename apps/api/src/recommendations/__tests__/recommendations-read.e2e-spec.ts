import { bootRecommendationsFixture, EMISSARY, FLEX, IRecommendationsFixture, KATSU, TALISHAR } from './recommendations-e2e.fixture';

const A = 'ancestral-harmony-blue';
const B = 'art-of-the-dragon-blood-red';
const C = 'art-of-the-dragon-claw-red';
const D = 'adrenaline-rush-red';
const E = 'adrenaline-rush-yellow';
const PRICED = 'art-of-the-dragon-blood-red';
const UNSTOCKED = 'art-of-the-dragon-claw-red';

describe('recommendations read (e2e)', () => {
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

  async function read(deckId: number, jwt: string) {
    return (await fixture.get(`/api/decks/${deckId}/recommendations`, jwt).expect(200)).body;
  }

  it('reports run, pending and failure for each history', async () => {
    const none = await freshDeck();
    expect(await read(none.deckId, none.jwt)).toEqual({ run: null, pending: false, failure: null, recommendations: [] });

    const pendingOnly = await freshDeck();
    await fixture.seedRun(pendingOnly.deckId, 'pending');
    expect(await read(pendingOnly.deckId, pendingOnly.jwt)).toEqual(
      expect.objectContaining({ run: null, pending: true, failure: null }),
    );

    const donePending = await freshDeck();
    const done = await fixture.seedDoneRun(donePending.deckId, [{ card: A }]);
    await fixture.seedRun(donePending.deckId, 'running', { claimedMinutesAgo: 0 });
    const donePendingBody = await read(donePending.deckId, donePending.jwt);
    expect(donePendingBody.run).toEqual({ id: done.runId, status: 'done', trigger: 'manual', finishedAt: expect.any(String), stale: false });
    expect(donePendingBody.pending).toBe(true);
    expect(donePendingBody.recommendations.map((row: { cardIdentifier: string }) => row.cardIdentifier)).toEqual([A]);

    const doneFailed = await freshDeck();
    const earlier = await fixture.seedDoneRun(doneFailed.deckId, [{ card: A }], { finishedAt: '2026-10-01T10:00:00Z' });
    await fixture.seedRun(doneFailed.deckId, 'failed', { error: 'MODEL_REFUSED', finishedAt: '2026-10-02T10:00:00Z' });
    const doneFailedBody = await read(doneFailed.deckId, doneFailed.jwt);
    expect(doneFailedBody.run.id).toBe(earlier.runId);
    expect(doneFailedBody.failure).toEqual({ code: 'MODEL_REFUSED', finishedAt: '2026-10-02T10:00:00.000Z' });
    expect(doneFailedBody.pending).toBe(false);

    const failedDone = await freshDeck();
    await fixture.seedRun(failedDone.deckId, 'failed', { error: 'RATE_LIMITED', finishedAt: '2026-10-01T10:00:00Z' });
    await fixture.seedDoneRun(failedDone.deckId, [{ card: A }], { finishedAt: '2026-10-02T10:00:00Z' });
    expect((await read(failedDone.deckId, failedDone.jwt)).failure).toBeNull();
  });

  it('stale follows the deck fingerprint', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.seedDoneRun(deckId, [{ card: A }]);
    expect((await read(deckId, jwt)).run.stale).toBe(false);

    await fixture
      .put(`/api/decks/${deckId}`, jwt)
      .send({
        heroIdentifier: KATSU,
        format: 'Classic Constructed',
        cards: [
          { cardIdentifier: KATSU, quantity: 1, slot: 'hero' },
          { cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
          { cardIdentifier: FLEX, quantity: 3, slot: 'mainboard' },
          { cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' },
        ],
      })
      .expect(200);

    expect((await read(deckId, jwt)).run.stale).toBe(true);
  });

  it('lists clear upgrades first and hides dismissed and deck cards', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.seedDoneRun(deckId, [
      { card: A, strength: 'consider' },
      { card: B, strength: 'clear_upgrade' },
      { card: C, strength: 'consider' },
      { card: D, strength: 'clear_upgrade' },
      { card: E, strength: 'consider' },
    ]);
    await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: C }).expect(201);
    await fixture.dataSource.query(
      `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, slot) VALUES ($1, $2, 1, 'mainboard')`,
      [deckId, E],
    );

    const body = await read(deckId, jwt);

    expect(body.recommendations.map((row: { cardIdentifier: string }) => row.cardIdentifier)).toEqual([B, D, A]);
    expect(body.recommendations.map((row: { strength: string }) => row.strength)).toEqual(['clear_upgrade', 'clear_upgrade', 'consider']);
  });

  it('joins ownership and store price live', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.dataSource.query(
      `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt")
       VALUES ((SELECT id FROM store WHERE slug = 'cupula-dt'), $1, 450, 3, 'https://www.cupuladt.com.br/produto/art-of-the-dragon-blood', 'Art of the Dragon: Blood (Red)', now())
       ON CONFLICT ("storeId", "cardIdentifier") DO UPDATE SET "priceCents" = 450, quantity = 3, "productUrl" = EXCLUDED."productUrl"`,
      [PRICED],
    );
    await fixture.dataSource.query(`DELETE FROM store_stock WHERE "cardIdentifier" = ANY($1)`, [[UNSTOCKED, A]]);
    await fixture.own(jwt, [{ cardIdentifier: A, quantity: 2 }]);
    await fixture.seedDoneRun(deckId, [{ card: A }, { card: PRICED }, { card: UNSTOCKED }]);

    const rows: Array<Record<string, unknown>> = (await read(deckId, jwt)).recommendations;
    const byCard = Object.fromEntries(rows.map((row) => [row.cardIdentifier, row]));

    expect(byCard[A]).toEqual(expect.objectContaining({ freeCopies: 2, name: 'Ancestral Harmony', slot: 'mainboard' }));
    expect(byCard[PRICED]).toEqual(
      expect.objectContaining({ freeCopies: 0, priceCents: 450, productUrl: 'https://www.cupuladt.com.br/produto/art-of-the-dragon-blood' }),
    );
    expect(byCard[UNSTOCKED]).toEqual(expect.objectContaining({ freeCopies: 0, priceCents: null, productUrl: null }));
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        'id', 'rank', 'cardIdentifier', 'name', 'pitch', 'imageUrl', 'slot', 'strength', 'reason', 'cutCardIdentifier',
        'cutName', 'cutSlot', 'freeCopies', 'priceCents', 'productUrl',
      ].sort(),
    );
  });

  it('drops a cut that left the deck', async () => {
    const { jwt, deckId } = await freshDeck();
    await fixture.seedDoneRun(deckId, [{ card: A, cut: FLEX, cutSlot: 'mainboard' }]);
    expect((await read(deckId, jwt)).recommendations[0]).toEqual(
      expect.objectContaining({ cutCardIdentifier: FLEX, cutName: 'Flex', cutSlot: 'mainboard' }),
    );

    await fixture.dataSource.query(`DELETE FROM deck_card WHERE "trackedDeckId" = $1 AND "cardIdentifier" = $2`, [deckId, FLEX]);

    expect((await read(deckId, jwt)).recommendations[0]).toEqual(
      expect.objectContaining({ cutCardIdentifier: null, cutName: null, cutSlot: null }),
    );
  });

  it('refuses foreign, malformed and anonymous reads', async () => {
    const { deckId } = await freshDeck();
    const stranger = await fixture.signUp('stranger');

    await fixture.get(`/api/decks/${deckId}/recommendations`, stranger.jwt).expect(404);
    await fixture.get(`/api/decks/abc/recommendations`, stranger.jwt).expect(400);
    await fixture.get(`/api/decks/${deckId}/recommendations`, '').expect(401);
  });

  it('clearUpgradeCount counts what the panel would show', async () => {
    const { jwt, deckId } = await freshDeck();
    const { ids } = await fixture.seedDoneRun(deckId, [
      { card: D, strength: 'clear_upgrade', cut: FLEX, cutSlot: 'mainboard' },
      { card: B, strength: 'clear_upgrade' },
      { card: A, strength: 'consider' },
    ]);
    const retired = await freshDeck();
    await fixture.seedDoneRun(retired.deckId, [{ card: D, strength: 'clear_upgrade' }]);
    await fixture.patch(`/api/decks/${retired.deckId}`, retired.jwt).send({ status: 'retired' }).expect(200);
    const empty = await freshDeck();

    const countFor = async (id: number, token: string): Promise<number> => {
      const response = await fixture.get('/api/decks', token).expect(200);
      return response.body.trackedDecks.find((deck: { id: number }) => deck.id === id).clearUpgradeCount;
    };

    expect(await countFor(deckId, jwt)).toBe(2);
    await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: B }).expect(201);
    expect(await countFor(deckId, jwt)).toBe(1);
    await fixture
      .post(`/api/decks/${deckId}/recommendations/${ids[0]}/adopt`, jwt)
      .send({ cutCardIdentifier: FLEX, cutSlot: 'mainboard' })
      .expect(201);
    expect(await countFor(deckId, jwt)).toBe(0);
    expect(await countFor(retired.deckId, retired.jwt)).toBe(0);
    expect(await countFor(empty.deckId, empty.jwt)).toBe(0);
    await fixture.get('/api/decks', '').expect(401);
  });
});

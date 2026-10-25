import { ADRENALINE, bootFixture, COAX, IFixture, IScenario, mainboard } from '../../replacements/__tests__/replacements-e2e.fixture';

describe('PUT /api/collection/owned (E2E)', () => {
  let fixture: IFixture;

  beforeAll(async () => {
    fixture = await bootFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  const threeCopies = () => fixture.scenario([mainboard(ADRENALINE, 3)]);

  function setOwned(owner: IScenario, body: Record<string, unknown>) {
    return fixture.put('/api/collection/owned', owner.sessionToken).send(body);
  }

  async function holdInLibrary(owner: IScenario, quantity: number): Promise<void> {
    await fixture
      .post('/api/collection/imports', owner.sessionToken)
      .send({ kind: 'paste', name: 'Lista colada', ready: [{ cardIdentifier: ADRENALINE, quantity }], pending: [] })
      .expect(201);
  }

  async function sources(owner: IScenario): Promise<Array<{ kind: string; quantity: number }>> {
    return fixture.dataSource.query(
      `SELECT s.kind, c.quantity FROM collection_card c JOIN csv_source s ON s.id = c."sourceId"
       WHERE c."cardIdentifier" = $1 AND s."userId" = (SELECT "userId" FROM tracked_deck WHERE id = $2) ORDER BY s.kind`,
      [ADRENALINE, owner.deckId],
    );
  }

  it('sets the owned total through the manual source in one statement', async () => {
    const owner = await threeCopies();
    await holdInLibrary(owner, 1);

    const res = await setOwned(owner, { deckId: owner.deckId, cardIdentifier: ADRENALINE, ownedTotal: 3 }).expect(200);

    expect(res.body).toMatchObject({ ownedTotal: 3, previousManualQuantity: 0 });
    expect(res.body.snapshot).toEqual(expect.objectContaining({ effectivePercent: expect.any(Number) }));
    expect(await sources(owner)).toEqual([
      { kind: 'manual', quantity: 2 },
      { kind: 'paste', quantity: 1 },
    ]);

    const again = await setOwned(owner, { deckId: owner.deckId, cardIdentifier: ADRENALINE, ownedTotal: 2 }).expect(200);
    expect(again.body).toMatchObject({ ownedTotal: 2, previousManualQuantity: 2 });
    expect(await sources(owner)).toEqual([
      { kind: 'manual', quantity: 1 },
      { kind: 'paste', quantity: 1 },
    ]);
  });

  it('two concurrent sets end on one of the two values', async () => {
    const owner = await threeCopies();

    await Promise.all([
      setOwned(owner, { deckId: owner.deckId, cardIdentifier: ADRENALINE, ownedTotal: 2 }).expect(200),
      setOwned(owner, { deckId: owner.deckId, cardIdentifier: ADRENALINE, ownedTotal: 3 }).expect(200),
    ]);

    const [manual] = await sources(owner);
    expect([2, 3]).toContain(manual!.quantity);
  });

  it("refuses a total above the deck's quantity and unknown targets", async () => {
    const owner = await threeCopies();
    const stranger = await threeCopies();
    await holdInLibrary(owner, 2);
    const before = await sources(owner);
    const valid = { deckId: owner.deckId, cardIdentifier: ADRENALINE };

    await setOwned(owner, { ...valid, ownedTotal: 4 }).expect(400);
    await setOwned(owner, { ...valid, ownedTotal: -1 }).expect(400);
    await setOwned(owner, { ...valid, ownedTotal: 1.5 }).expect(400);
    await setOwned(owner, valid).expect(400);
    await setOwned(owner, { ...valid, ownedTotal: 1 }).expect(400);
    await setOwned(owner, { deckId: stranger.deckId, cardIdentifier: ADRENALINE, ownedTotal: 1 }).expect(404);
    await setOwned(owner, { deckId: 999999999, cardIdentifier: ADRENALINE, ownedTotal: 1 }).expect(404);
    await setOwned(owner, { deckId: owner.deckId, cardIdentifier: COAX, ownedTotal: 1 }).expect(404);

    expect(await sources(owner)).toEqual(before);
    expect(await sources(stranger)).toEqual([]);
  });
});

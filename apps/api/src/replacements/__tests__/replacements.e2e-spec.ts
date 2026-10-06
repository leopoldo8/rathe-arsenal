import { catalog, scoreCandidate, TIER_1_CONFIG } from '@rathe-arsenal/engine';
import {
  ADRENALINE,
  bootFixture,
  COAX,
  EMISSARY,
  FLEX,
  IFixture,
  IScenario,
  KATSU,
  mainboard,
  TALISHAR,
  withoutTimestamp,
} from './replacements-e2e.fixture';

const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

/** A tier 1 stand-in for coax, found with the engine's own scorer, that is not coax itself. */
function coaxStandIn(): string {
  const coax = catalog.getCard(COAX);
  const found = catalog.cards.find((card) => {
    if (card.cardIdentifier === COAX || card.cardIdentifier === EMISSARY || card.cardIdentifier === FLEX) return false;
    const score = scoreCandidate(coax, card, TIER_1_CONFIG);
    return score !== null && score >= TIER_1_CONFIG.floorScore;
  });
  if (!found) throw new Error('no tier 1 stand-in for coax in the catalog');
  return found.cardIdentifier;
}

describe('card replacements (E2E)', () => {
  let fixture: IFixture;

  beforeAll(async () => {
    fixture = await bootFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  const pickBody = (overrides: Record<string, unknown> = {}) => ({
    originalCardIdentifier: EMISSARY,
    slot: 'mainboard',
    replacementCardIdentifier: COAX,
    pickedFrom: 'very_close',
    ...overrides,
  });

  async function pick(owner: IScenario, overrides: Record<string, unknown> = {}, expected = 201) {
    return fixture.post(`/api/decks/${owner.deckId}/replacements`, owner.jwt).send(pickBody(overrides)).expect(expected);
  }

  async function replacementId(owner: IScenario, overrides: Record<string, unknown> = {}): Promise<string> {
    return (await pick(owner, overrides)).body.replacement.id as string;
  }

  async function state(owner: IScenario) {
    return {
      deckCards: await fixture.deckCards(owner.deckId),
      replacements: await fixture.replacementRows(owner.deckId),
      swaps: await fixture.swapRows(owner.deckId),
    };
  }

  it('a pick moves the missing copies and records the original', async () => {
    const owner = await fixture.scenario();

    const res = await pick(owner);

    expect(res.body.replacement).toEqual({
      id: expect.any(String),
      slot: 'mainboard',
      originalCardIdentifier: EMISSARY,
      replacementCardIdentifier: COAX,
      quantity: 2,
      pickedFrom: 'very_close',
      status: 'active',
      createdAt: expect.any(String),
      resolvedAt: null,
    });
    const cards = await fixture.deckCards(owner.deckId);
    expect(cards[`${EMISSARY}@mainboard`]).toBeUndefined();
    expect(cards[`${COAX}@mainboard`]).toBe(2);

    const partial = await fixture.scenario([mainboard(COAX, 1)]);
    await fixture.own(partial.jwt, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
    const moved = await pick(partial);
    expect(moved.body.replacement.quantity).toBe(1);
    const partialCards = await fixture.deckCards(partial.deckId);
    expect(partialCards[`${EMISSARY}@mainboard`]).toBe(1);
    expect(partialCards[`${COAX}@mainboard`]).toBe(2);
  });

  it.each(['very_close', 'close', 'other_pitch', 'generic', 'search'])(
    'a pick moves the missing copies and records the original: stores and returns pickedFrom %s',
    async (pickedFrom) => {
      const owner = await fixture.scenario();

      const res = await pick(owner, { pickedFrom });

      expect(res.body.replacement.pickedFrom).toBe(pickedFrom);
      const [row] = await fixture.replacementRows(owner.deckId);
      expect(row!.pickedFrom).toBe(pickedFrom);
    },
  );

  it('the snapshot after a pick shows the moved copies', async () => {
    const owner = await fixture.scenario();
    await pick(owner);

    const breakdown = await fixture.latestBreakdown(owner.deckId);

    expect(breakdown.missing).toEqual(
      expect.arrayContaining([expect.objectContaining({ cardIdentifier: COAX, quantity: 2 })]),
    );
    expect(JSON.stringify(breakdown)).not.toContain(EMISSARY);
  });

  it('a later recompute gives a protected replacement no stand-in', async () => {
    const owner = await fixture.scenario();
    await pick(owner);
    await fixture.own(owner.jwt, [{ cardIdentifier: coaxStandIn(), quantity: 3 }]);
    await fixture.post('/api/collection/mark-owned', owner.jwt).send({ deckId: owner.deckId, cardIdentifier: FLEX }).expect(201);

    const breakdown = await fixture.latestBreakdown(owner.deckId);

    expect(breakdown.missing).toEqual(
      expect.arrayContaining([expect.objectContaining({ cardIdentifier: COAX, quantity: 2 })]),
    );
    expect(breakdown.substituted.filter((entry) => entry.original.cardIdentifier === COAX)).toEqual([]);
  });

  it("a pick retires the original's pending and approved swaps", async () => {
    // One emissary owned: the original stays in its slot after the pick, so reconciliation alone would leave its swap rows alone.
    const owner = await fixture.scenario();
    await fixture.own(owner.jwt, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
    const insertSwap = (substitute: string, status: string) =>
      fixture.dataSource.query(
        `INSERT INTO swap_suggestion ("userId", "trackedDeckId", "cardIdentifier", slot, "substituteIdentifier", quantity, tier, confidence, rationale, status)
         SELECT d."userId", d.id, $2, 'mainboard', $3, 1, 1, 95, 'seeded', $4 FROM tracked_deck d WHERE d.id = $1`,
        [owner.deckId, EMISSARY, substitute, status],
      );
    await insertSwap('blow-for-a-blow-red', 'pending');
    await insertSwap('wounded-bull-red', 'approved');
    await insertSwap('sink-below-red', 'rejected');
    const before = await fixture.swapRows(owner.deckId);
    const idOf = (rows: Array<Record<string, unknown>>, status: string) => rows.find((r) => r.status === status)!.id as string;

    await pick(owner);

    const after = await fixture.swapRows(owner.deckId);
    const emissaryRows = after.filter((row) => row.cardIdentifier === EMISSARY);
    expect(emissaryRows.find((r) => r.id === idOf(before, 'pending'))!.status).toBe('retired');
    expect(emissaryRows.find((r) => r.id === idOf(before, 'approved'))!.status).toBe('retired');
    expect(emissaryRows.find((r) => r.id === idOf(before, 'rejected'))!.status).toBe('rejected');

    const listed = (await fixture.get('/api/swaps?state=all', owner.jwt).expect(200)).body.rows as Array<{ id: string }>;
    const listedIds = listed.map((row) => row.id);
    expect(listedIds).not.toContain(idOf(before, 'pending'));
    expect(listedIds).not.toContain(idOf(before, 'approved'));
    expect(listedIds).toContain(idOf(before, 'rejected'));
  });

  it('refuses an illegal replacement and changes nothing', async () => {
    const crowded = await fixture.scenario([mainboard(COAX, 2)]);
    const plain = await fixture.scenario();
    const cases: ReadonlyArray<[string, IScenario, Record<string, unknown>]> = [
      ['a card not legal for Katsu', plain, { replacementCardIdentifier: 'a-good-clean-fight-red' }],
      ['a card that would exceed 3 copies', crowded, {}],
      ['the weapon slot', plain, { originalCardIdentifier: TALISHAR, slot: 'weapon' }],
      ['the hero slot', plain, { originalCardIdentifier: KATSU, slot: 'hero' }],
      ['the original itself', plain, { replacementCardIdentifier: EMISSARY }],
    ];

    for (const [label, owner, overrides] of cases) {
      const before = await state(owner);
      const res = await pick(owner, overrides, 409);
      expect({ label, code: res.body.code }).toEqual({ label, code: 'REPLACEMENT_ILLEGAL' });
      expect(await state(owner)).toEqual(before);
    }
  });

  it('refuses an illegal replacement and changes nothing: the card in two slots counts both', async () => {
    const owner = await fixture.scenario([mainboard(COAX, 1), { cardIdentifier: COAX, quantity: 1, slot: 'equipment' }]);
    const before = await state(owner);

    const res = await pick(owner, {}, 409);

    expect(res.body.code).toBe('REPLACEMENT_ILLEGAL');
    expect(await state(owner)).toEqual(before);
  });

  it('refuses a pick when nothing is missing', async () => {
    const owner = await fixture.scenario();
    await fixture.own(owner.jwt, [{ cardIdentifier: EMISSARY, quantity: 2 }]);
    const before = await state(owner);

    const res = await pick(owner, {}, 409);

    expect(res.body.code).toBe('NOTHING_TO_REPLACE');
    expect(await state(owner)).toEqual(before);
  });

  it('serializes two concurrent picks for one card', async () => {
    const owner = await fixture.scenario();

    const responses = await Promise.all([
      fixture.post(`/api/decks/${owner.deckId}/replacements`, owner.jwt).send(pickBody({ replacementCardIdentifier: COAX })),
      fixture.post(`/api/decks/${owner.deckId}/replacements`, owner.jwt).send(pickBody({ replacementCardIdentifier: ADRENALINE })),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    const loser = responses.find((res) => res.status === 409)!;
    expect(loser.body.code).toBe('NOTHING_TO_REPLACE');
    const winner = responses.find((res) => res.status === 201)!.body.replacement;
    const rows = await fixture.replacementRows(owner.deckId);
    expect(rows.filter((row) => row.status === 'active')).toHaveLength(1);
    const cards = await fixture.deckCards(owner.deckId);
    expect(cards[`${winner.replacementCardIdentifier}@mainboard`]).toBe(2);
    expect(cards[`${EMISSARY}@mainboard`]).toBeUndefined();
  });

  it('rejects malformed picks with 400', async () => {
    const owner = await fixture.scenario();
    const before = await state(owner);
    const { slot: _slot, ...withoutSlot } = pickBody();
    const { replacementCardIdentifier: _replacement, ...withoutReplacement } = pickBody();
    const { originalCardIdentifier: _original, ...withoutOriginal } = pickBody();
    const { pickedFrom: _pickedFrom, ...withoutPickedFrom } = pickBody();

    for (const body of [
      withoutSlot,
      withoutReplacement,
      withoutOriginal,
      withoutPickedFrom,
      pickBody({ pickedFrom: 'other' }),
      pickBody({ replacementCardIdentifier: 'not-a-real-card-red' }),
      pickBody({ originalCardIdentifier: 'not-a-real-card-red' }),
    ]) {
      await fixture.post(`/api/decks/${owner.deckId}/replacements`, owner.jwt).send(body).expect(400);
    }
    expect(await state(owner)).toEqual(before);
  });

  it('rejects malformed picks with 400: every field at its length bounds and a non-integer deck id', async () => {
    const owner = await fixture.scenario();
    const before = await state(owner);
    const post = (body: Record<string, unknown>) =>
      fixture.post(`/api/decks/${owner.deckId}/replacements`, owner.jwt).send(body);

    for (const field of ['originalCardIdentifier', 'replacementCardIdentifier']) {
      await post(pickBody({ [field]: '' })).expect(400);
      await post(pickBody({ [field]: 'c'.repeat(129) })).expect(400);
      await post(pickBody({ [field]: 123 })).expect(400);
    }
    await post(pickBody({ slot: '' })).expect(400);
    await post(pickBody({ slot: 's'.repeat(65) })).expect(400);
    await post(pickBody({ pickedFrom: 5 })).expect(400);
    // 128 and 64 characters pass validation and fail later as unknown cards, never as a server error.
    await post(pickBody({ replacementCardIdentifier: 'c'.repeat(128) })).expect(400);
    await post(pickBody({ slot: 's'.repeat(64) })).expect(409);

    await fixture.post('/api/decks/not-a-number/replacements', owner.jwt).send(pickBody()).expect(400);
    await fixture.post('/api/decks/1.5/replacements', owner.jwt).send(pickBody()).expect(400);
    expect(await state(owner)).toEqual(before);
  });

  it('revert moves the copies back', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);

    const res = await fixture.post(`/api/replacements/${id}/revert`, owner.jwt).expect(200);

    expect(res.body.replacement).toEqual(expect.objectContaining({ id, status: 'reverted', resolvedAt: expect.any(String) }));
    const cards = await fixture.deckCards(owner.deckId);
    expect(cards[`${EMISSARY}@mainboard`]).toBe(2);
    expect(cards[`${COAX}@mainboard`]).toBeUndefined();

    const partial = await fixture.scenario([mainboard(COAX, 1)]);
    await fixture.own(partial.jwt, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
    const partialId = await replacementId(partial);
    await fixture.post(`/api/replacements/${partialId}/revert`, partial.jwt).expect(200);
    const partialCards = await fixture.deckCards(partial.deckId);
    expect(partialCards[`${EMISSARY}@mainboard`]).toBe(2);
    expect(partialCards[`${COAX}@mainboard`]).toBe(1);
  });

  it('the snapshot after a revert shows the original', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    await fixture.post(`/api/replacements/${id}/revert`, owner.jwt).expect(200);

    const breakdown = await fixture.latestBreakdown(owner.deckId);

    const original = [...breakdown.missing, ...breakdown.substituted.map((entry) => entry.original)].filter(
      (entry) => entry.cardIdentifier === EMISSARY,
    );
    expect(original.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(2);
    expect(JSON.stringify(breakdown)).not.toContain(COAX);
  });

  it('refuses to resolve a closed replacement', async () => {
    const owner = await fixture.scenario();
    for (const status of ['kept', 'reverted', 'removed']) {
      const [{ id }] = await fixture.dataSource.query(
        `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status, "resolvedAt")
         SELECT d."userId", d.id, 'mainboard', $2, $3, 1, 'close', $4, now() FROM tracked_deck d WHERE d.id = $1 RETURNING id`,
        [owner.deckId, EMISSARY, COAX, status],
      );
      for (const action of ['revert', 'keep']) {
        const before = await state(owner);
        const res = await fixture.post(`/api/replacements/${id}/${action}`, owner.jwt).expect(409);
        expect({ status, action, code: res.body.code }).toEqual({ status, action, code: 'REPLACEMENT_NOT_ACTIVE' });
        expect(await state(owner)).toEqual(before);
      }
    }
  });

  it("answers another user's replacement like a missing one", async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    const stranger = await fixture.signUp('stranger');

    for (const action of ['revert', 'keep']) {
      const foreign = await fixture.post(`/api/replacements/${id}/${action}`, stranger.jwt).expect(404);
      const missing = await fixture.post(`/api/replacements/${RANDOM_UUID}/${action}`, stranger.jwt).expect(404);
      expect(withoutTimestamp(foreign.body)).toEqual(withoutTimestamp(missing.body));
      await fixture.post(`/api/replacements/not-a-uuid/${action}`, stranger.jwt).expect(400);
    }
  });

  it("answers another user's deck exactly like a missing deck", async () => {
    const owner = await fixture.scenario();
    const stranger = await fixture.signUp('stranger-deck');
    const requests = (deckId: number) => [
      () => fixture.get(`/api/decks/${deckId}/alternatives`, stranger.jwt).query({ cardIdentifier: EMISSARY, slot: 'mainboard' }),
      () => fixture.post(`/api/decks/${deckId}/replacements`, stranger.jwt).send(pickBody()),
      () => fixture.get(`/api/decks/${deckId}`, stranger.jwt),
    ];

    const foreign = requests(owner.deckId);
    const missing = requests(2_000_000_000);
    for (let index = 0; index < foreign.length; index += 1) {
      const a = await foreign[index]!().expect(404);
      const b = await missing[index]!().expect(404);
      expect(withoutTimestamp(a.body)).toEqual(withoutTimestamp(b.body));
    }
  });

  it('a composition save that drops the replacement closes it', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    const survivingCards = [
      { cardIdentifier: KATSU, quantity: 1, slot: 'hero' },
      { cardIdentifier: FLEX, quantity: 2, slot: 'mainboard' },
      { cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' },
    ];

    await fixture.put(`/api/decks/${owner.deckId}`, owner.jwt)
      .send({ heroIdentifier: KATSU, format: 'Classic Constructed', cards: survivingCards })
      .expect(200);

    const [row] = await fixture.replacementRows(owner.deckId);
    expect(row).toEqual(expect.objectContaining({ id, status: 'removed' }));
    expect(row!.resolvedAt).not.toBeNull();
  });

  it('a composition save that drops the replacement closes it: the save and scratch-create responses carry replacements', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    const cards = Object.entries(await fixture.deckCards(owner.deckId)).map(([key, quantity]) => ({
      cardIdentifier: key.split('@')[0]!,
      slot: key.split('@')[1]!,
      quantity,
    }));

    const kept = await fixture.put(`/api/decks/${owner.deckId}`, owner.jwt)
      .send({ heroIdentifier: KATSU, format: 'Classic Constructed', cards })
      .expect(200);
    expect(kept.body.replacements).toEqual([expect.objectContaining({ id, originalName: 'Emissary of Tides', quantity: 2 })]);

    const dropped = await fixture.put(`/api/decks/${owner.deckId}`, owner.jwt)
      .send({ heroIdentifier: KATSU, format: 'Classic Constructed', cards: cards.filter((c) => c.cardIdentifier !== COAX) })
      .expect(200);
    expect(dropped.body.replacements).toEqual([]);

    const scratch = await fixture.post('/api/decks', owner.jwt)
      .send({ heroIdentifier: KATSU, format: 'Classic Constructed' })
      .expect(201);
    expect(scratch.body.replacements).toEqual([]);
  });

  it('keep closes the replacement and leaves the deck', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    const cardsBefore = await fixture.deckCards(owner.deckId);
    const snapshotsBefore = await fixture.snapshotCount(owner.deckId);

    const res = await fixture.post(`/api/replacements/${id}/keep`, owner.jwt).expect(200);

    expect(res.body.replacement).toEqual(expect.objectContaining({ id, status: 'kept', resolvedAt: expect.any(String) }));
    expect(await fixture.deckCards(owner.deckId)).toEqual(cardsBefore);
    expect(await fixture.snapshotCount(owner.deckId)).toBe(snapshotsBefore + 1);
    const detail = await fixture.get(`/api/decks/${owner.deckId}`, owner.jwt).expect(200);
    expect(detail.body.replacements).toEqual([]);
  });

  it('a kept replacement can get a stand-in', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    await fixture.post(`/api/replacements/${id}/keep`, owner.jwt).expect(200);

    // Enough copies for the deck's other missing card too, which the engine serves first.
    await fixture.own(owner.jwt, [{ cardIdentifier: coaxStandIn(), quantity: 3 }]);
    await fixture.post('/api/collection/mark-owned', owner.jwt).send({ deckId: owner.deckId, cardIdentifier: FLEX }).expect(201);

    const breakdown = await fixture.latestBreakdown(owner.deckId);
    expect(breakdown.substituted.some((entry) => entry.original.cardIdentifier === COAX)).toBe(true);
  });

  it('the deck detail lists active replacements only', async () => {
    const owner = await fixture.scenario();
    const activeId = await replacementId(owner);
    for (const status of ['kept', 'reverted', 'removed']) {
      await fixture.dataSource.query(
        `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status, "resolvedAt")
         SELECT d."userId", d.id, 'mainboard', $2, $3, 1, 'close', $4, now() FROM tracked_deck d WHERE d.id = $1`,
        [owner.deckId, FLEX, ADRENALINE, status],
      );
    }

    const detail = await fixture.get(`/api/decks/${owner.deckId}`, owner.jwt).expect(200);

    expect(detail.body.replacements).toEqual([
      {
        id: activeId,
        slot: 'mainboard',
        originalCardIdentifier: EMISSARY,
        originalName: 'Emissary of Tides',
        replacementCardIdentifier: COAX,
        quantity: 2,
        originalOwned: false,
      },
    ]);
  });

  it('the deck detail lists active replacements only: names an original with punctuation by its catalog name', async () => {
    const owner = await fixture.scenario([mainboard('a-moments-peace-blue', 1)]);
    await replacementId(owner, { originalCardIdentifier: 'a-moments-peace-blue' });

    const detail = await fixture.get(`/api/decks/${owner.deckId}`, owner.jwt).expect(200);

    expect(detail.body.replacements).toEqual([
      expect.objectContaining({ originalCardIdentifier: 'a-moments-peace-blue', originalName: "A Moment's Peace" }),
    ]);
  });

  it('never deletes a replacement row', async () => {
    const owner = await fixture.scenario([mainboard('sink-below-red', 1)]);
    const first = await replacementId(owner);
    await fixture.post(`/api/replacements/${first}/revert`, owner.jwt).expect(200);
    const second = await replacementId(owner);
    await fixture.post(`/api/replacements/${second}/keep`, owner.jwt).expect(200);
    await replacementId(owner, { originalCardIdentifier: FLEX, replacementCardIdentifier: ADRENALINE });
    await replacementId(owner, { originalCardIdentifier: 'sink-below-red', replacementCardIdentifier: 'sink-below-blue' });
    // A save that drops only the adrenaline copies closes that record as removed.
    const cards = Object.entries(await fixture.deckCards(owner.deckId))
      .map(([key, quantity]) => ({ cardIdentifier: key.split('@')[0]!, slot: key.split('@')[1]!, quantity }))
      .filter((card) => card.cardIdentifier !== ADRENALINE);
    await fixture.put(`/api/decks/${owner.deckId}`, owner.jwt)
      .send({ heroIdentifier: KATSU, format: 'Classic Constructed', cards })
      .expect(200);

    const rows = await fixture.replacementRows(owner.deckId);
    expect(rows.map((row) => row.status).sort()).toEqual(['active', 'kept', 'removed', 'reverted']);

    await fixture.dataSource.query(`DELETE FROM tracked_deck WHERE id = $1`, [owner.deckId]);
    expect(await fixture.replacementRows(owner.deckId)).toEqual([]);
  });

  it('rejects every replacement route without a token', async () => {
    const owner = await fixture.scenario();
    const id = await replacementId(owner);
    const server = fixture.app.getHttpServer();
    const request = (await import('supertest')).default;

    await request(server).get(`/api/decks/${owner.deckId}/alternatives`).query({ cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(401);
    await request(server).post(`/api/decks/${owner.deckId}/replacements`).send(pickBody()).expect(401);
    await request(server).post(`/api/replacements/${id}/revert`).expect(401);
    await request(server).post(`/api/replacements/${id}/keep`).expect(401);
    await request(server).get(`/api/decks/${owner.deckId}`).expect(401);
  });
});

import { Logger } from '@nestjs/common';
import { bootRecommendationsFixture, COAX, EMISSARY, FLEX, IRecommendationsFixture, KATSU, TALISHAR } from './recommendations-e2e.fixture';

const ADRENALINE = 'adrenaline-rush-red';
const LEGENDARY = 'amethyst-amulet-blue';
const WARRIOR = 'a-bit-off-the-side-red';
const LANTERN = 'arcane-lantern';
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

describe('adopt a recommendation (e2e)', () => {
  let fixture: IRecommendationsFixture;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture();
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function deckWith(card: string, cut?: string): Promise<{ jwt: string; deckId: number; recommendationId: string }> {
    const scenario = await fixture.scenario();
    await fixture.clearRuns(scenario.deckId);
    const { ids } = await fixture.seedDoneRun(scenario.deckId, [{ card, strength: 'clear_upgrade', ...(cut ? { cut } : {}) }]);
    return { ...scenario, recommendationId: ids[0]! };
  }

  function adopt(deckId: number, recommendationId: string, jwt: string, body: object) {
    return fixture.post(`/api/decks/${deckId}/recommendations/${recommendationId}/adopt`, jwt).send(body);
  }

  async function snapshotOfRows(deckId: number) {
    return {
      deckCards: await fixture.deckCards(deckId),
      replacements: (await fixture.replacementRows(deckId)).length,
      runs: (await fixture.runs(deckId)).map((run) => run.id),
    };
  }

  it('adopt moves the cut copies up to the copy limit', async () => {
    const plain = await deckWith(ADRENALINE, FLEX);

    const response = await adopt(plain.deckId, plain.recommendationId, plain.jwt, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(201);

    expect(response.body.replacement).toEqual(
      expect.objectContaining({
        slot: 'mainboard',
        originalCardIdentifier: FLEX,
        replacementCardIdentifier: ADRENALINE,
        quantity: 2,
        pickedFrom: 'recommendation',
        status: 'active',
      }),
    );
    const cards = await fixture.deckCards(plain.deckId);
    expect(cards[`${FLEX}@mainboard`]).toBeUndefined();
    expect(cards[`${ADRENALINE}@mainboard`]).toBe(2);
    const rows = await fixture.replacementRows(plain.deckId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ quantity: 2, pickedFrom: 'recommendation', status: 'active' }));
    const breakdown = await fixture.latestBreakdown(plain.deckId);
    const listed = [...breakdown.exact, ...breakdown.missing].map((entry) => entry.cardIdentifier);
    expect(listed).toContain(ADRENALINE);
    expect(listed).not.toContain(FLEX);
    const pending = (await fixture.runs(plain.deckId)).filter((run) => run.status === 'pending');
    expect(pending.map((run) => run.trigger)).toEqual(['auto']);

    const legendary = await deckWith(LEGENDARY, FLEX);
    await adopt(legendary.deckId, legendary.recommendationId, legendary.jwt, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(201);
    const legendaryCards = await fixture.deckCards(legendary.deckId);
    expect(legendaryCards[`${LEGENDARY}@mainboard`]).toBe(1);
    expect(legendaryCards[`${FLEX}@mainboard`]).toBe(1);
  });

  it('refuses illegal adoptions without changing rows', async () => {
    const cases: ReadonlyArray<[string, string, object, (deckId: number) => Promise<void>]> = [
      ['copy limit reached', ADRENALINE, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }, async (deckId) => {
        await fixture.dataSource.query(
          `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, slot) VALUES ($1, $2, 3, 'mainboard')`,
          [deckId, ADRENALINE],
        );
      }],
      ['not legal for the hero', WARRIOR, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }, async () => undefined],
      ['cut slot weapon', ADRENALINE, { cutCardIdentifier: TALISHAR, cutSlot: 'weapon' }, async () => undefined],
      ['cut slot hero', ADRENALINE, { cutCardIdentifier: KATSU, cutSlot: 'hero' }, async () => undefined],
      ['equipment with a mainboard cut', LANTERN, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }, async () => undefined],
      ['cut is the recommended card', ADRENALINE, { cutCardIdentifier: ADRENALINE, cutSlot: 'mainboard' }, async (deckId) => {
        await fixture.dataSource.query(
          `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, slot) VALUES ($1, $2, 1, 'mainboard')`,
          [deckId, ADRENALINE],
        );
      }],
    ];

    for (const [label, card, body, arrange] of cases) {
      const target = await deckWith(card);
      await arrange(target.deckId);
      const before = await snapshotOfRows(target.deckId);

      const response = await adopt(target.deckId, target.recommendationId, target.jwt, body);

      expect({ label, status: response.status, code: response.body.code }).toEqual({ label, status: 409, code: 'REPLACEMENT_ILLEGAL' });
      expect({ label, rows: await snapshotOfRows(target.deckId) }).toEqual({ label, rows: before });
    }
  });

  it('refuses a cut that is not in the slot', async () => {
    const target = await deckWith(ADRENALINE);
    const before = await snapshotOfRows(target.deckId);

    const response = await adopt(target.deckId, target.recommendationId, target.jwt, { cutCardIdentifier: COAX, cutSlot: 'mainboard' }).expect(409);

    expect(response.body.code).toBe('NOTHING_TO_REPLACE');
    expect(await snapshotOfRows(target.deckId)).toEqual(before);
  });

  it('answers 404 for foreign or unknown targets', async () => {
    const owner = await deckWith(ADRENALINE);
    const other = await deckWith(ADRENALINE);
    const body = { cutCardIdentifier: FLEX, cutSlot: 'mainboard' };

    await adopt(owner.deckId, other.recommendationId, owner.jwt, body).expect(404);
    await adopt(owner.deckId, RANDOM_UUID, owner.jwt, body).expect(404);
    await adopt(other.deckId, other.recommendationId, owner.jwt, body).expect(404);
    await adopt(2147483000, owner.recommendationId, owner.jwt, body).expect(404);
    expect(await fixture.replacementRows(owner.deckId)).toHaveLength(0);
    expect(await fixture.replacementRows(other.deckId)).toHaveLength(0);
  });

  it('refuses malformed adoptions', async () => {
    const target = await deckWith(ADRENALINE);
    const bodies: ReadonlyArray<[string, object]> = [
      ['no cut card', { cutSlot: 'mainboard' }],
      ['no cut slot', { cutCardIdentifier: FLEX }],
      ['65-character slot', { cutCardIdentifier: FLEX, cutSlot: 's'.repeat(65) }],
      ['129-character card', { cutCardIdentifier: 'x'.repeat(129), cutSlot: 'mainboard' }],
      ['unknown card', { cutCardIdentifier: 'not-a-card', cutSlot: 'mainboard' }],
    ];
    for (const [label, body] of bodies) {
      const response = await adopt(target.deckId, target.recommendationId, target.jwt, body);
      expect({ label, status: response.status }).toEqual({ label, status: 400 });
    }
    await adopt(target.deckId, 'not-a-uuid', target.jwt, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(400);
    await adopt(target.deckId, target.recommendationId, '', { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(401);
    expect(await fixture.replacementRows(target.deckId)).toHaveLength(0);
  });

  it('revert restores the cut and relists the card', async () => {
    const target = await deckWith(ADRENALINE, FLEX);
    const adopted = await adopt(target.deckId, target.recommendationId, target.jwt, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(201);
    const listedAfterAdopt = (await fixture.get(`/api/decks/${target.deckId}/recommendations`, target.jwt).expect(200)).body.recommendations;
    expect(listedAfterAdopt).toEqual([]);

    await fixture.post(`/api/replacements/${adopted.body.replacement.id}/revert`, target.jwt).expect(200);

    const cards = await fixture.deckCards(target.deckId);
    expect(cards[`${FLEX}@mainboard`]).toBe(2);
    expect(cards[`${ADRENALINE}@mainboard`]).toBeUndefined();
    const listed = (await fixture.get(`/api/decks/${target.deckId}/recommendations`, target.jwt).expect(200)).body.recommendations;
    expect(listed.map((row: { cardIdentifier: string }) => row.cardIdentifier)).toEqual([ADRENALINE]);
  });

  it('an adopted card never raises the original prompt', async () => {
    const target = await deckWith(ADRENALINE, FLEX);
    await adopt(target.deckId, target.recommendationId, target.jwt, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(201);
    await fixture
      .post(`/api/decks/${target.deckId}/replacements`, target.jwt)
      .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'close' })
      .expect(201);
    await fixture.own(target.jwt, [
      { cardIdentifier: FLEX, quantity: 4 },
      { cardIdentifier: EMISSARY, quantity: 2 },
    ]);

    const detail = await fixture.get(`/api/decks/${target.deckId}`, target.jwt).expect(200);

    const byOriginal = Object.fromEntries(
      detail.body.replacements.map((row: { originalCardIdentifier: string; originalOwned: boolean }) => [row.originalCardIdentifier, row.originalOwned]),
    );
    expect(byOriginal).toEqual({ [FLEX]: false, [EMISSARY]: true });
  });

  it('logs the adoption', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    try {
      const suggested = await deckWith(ADRENALINE, FLEX);
      await adopt(suggested.deckId, suggested.recommendationId, suggested.jwt, { cutCardIdentifier: FLEX, cutSlot: 'mainboard' }).expect(201);
      const chosen = await deckWith(ADRENALINE, FLEX);
      await adopt(chosen.deckId, chosen.recommendationId, chosen.jwt, { cutCardIdentifier: EMISSARY, cutSlot: 'mainboard' }).expect(201);

      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'recommendations.adopted',
          trackedDeckId: suggested.deckId,
          recommendationId: suggested.recommendationId,
          rank: 1,
          strength: 'clear_upgrade',
          cutCardIdentifier: FLEX,
          recommendedCardIdentifier: ADRENALINE,
          quantity: 2,
          suggestedCut: true,
        }),
      );
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'recommendations.adopted', trackedDeckId: chosen.deckId, cutCardIdentifier: EMISSARY, suggestedCut: false }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('the alternatives pick still refuses the recommendation origin', async () => {
    const target = await deckWith(ADRENALINE);

    await fixture
      .post(`/api/decks/${target.deckId}/replacements`, target.jwt)
      .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'recommendation' })
      .expect(400);
    expect(await fixture.replacementRows(target.deckId)).toHaveLength(0);
  });
});

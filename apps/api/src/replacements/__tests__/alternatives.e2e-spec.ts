import { ADRENALINE, bootFixture, COAX, EMISSARY, FLEX, mainboard, IFixture, KATSU, TALISHAR, withoutTimestamp } from './replacements-e2e.fixture';

describe('GET /api/decks/:deckId/alternatives (E2E)', () => {
  let fixture: IFixture;

  beforeAll(async () => {
    fixture = await bootFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  function alternatives(jwt: string, deckId: number, query: Record<string, string>) {
    return fixture.get(`/api/decks/${deckId}/alternatives`, jwt).query(query);
  }

  it('returns needed 2 for a card missing both copies', async () => {
    const owner = await fixture.scenario();

    const none = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(200);
    expect(none.body.needed).toBe(2);

    await fixture.own(owner.jwt, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
    const one = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(200);
    expect(one.body.needed).toBe(1);
  });

  it('answers with the documented shape', async () => {
    const owner = await fixture.scenario();

    const res = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(200);

    expect(Object.keys(res.body).sort()).toEqual(['groups', 'needed']);
    expect(res.body.groups.map((g: { group: string }) => g.group)).toEqual(['very_close', 'close', 'other_pitch', 'generic']);
    for (const group of res.body.groups as Array<{ group: string; cards: Array<Record<string, unknown>> }>) {
      expect(Object.keys(group).sort()).toEqual(['cards', 'group']);
      expect(group.cards.length).toBeLessThanOrEqual(10);
      for (const card of group.cards) {
        expect(Object.keys(card).sort()).toEqual(
          ['cardIdentifier', 'freeCopies', 'imageUrl', 'name', 'pitch', 'priceCents', 'productUrl', 'rationale'].sort(),
        );
      }
    }
    expect(res.body.groups[0].cards).toHaveLength(10);
    expect(res.body.groups[0].cards[0].rationale).toEqual(
      expect.objectContaining({ tier: 1, relaxed: null, pitch: 'red' }),
    );
  });

  it('reports owned copies and shows search results for a name', async () => {
    const owner = await fixture.scenario();
    await fixture.own(owner.jwt, [{ cardIdentifier: COAX, quantity: 2 }]);

    const res = await alternatives(owner.jwt, owner.deckId, {
      cardIdentifier: EMISSARY,
      slot: 'mainboard',
      q: 'coax',
    }).expect(200);

    expect(res.body.groups).toHaveLength(1);
    expect(res.body.groups[0].group).toBe('search');
    const coax = res.body.groups[0].cards.find((c: { cardIdentifier: string }) => c.cardIdentifier === COAX);
    expect(coax.freeCopies).toBe(2);
  });

  it('bounds q between 2 and 50 characters', async () => {
    const owner = await fixture.scenario();
    const status = async (q: string) =>
      (await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY, slot: 'mainboard', q })).status;

    expect(await status('a')).toBe(400);
    expect(await status('ab')).toBe(200);
    expect(await status('a'.repeat(50))).toBe(200);
    expect(await status('a'.repeat(51))).toBe(400);
    expect(await status('  a  ')).toBe(400);

    // The two required parameters (extended after verification).
    await alternatives(owner.jwt, owner.deckId, { slot: 'mainboard' }).expect(400);
    await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY }).expect(400);
  });

  it('bounds q between 2 and 50 characters: cardIdentifier, slot and deck id at their limits', async () => {
    const owner = await fixture.scenario();
    const ask = (query: Record<string, string>) => alternatives(owner.jwt, owner.deckId, query);

    await ask({ cardIdentifier: '', slot: 'mainboard' }).expect(400);
    await ask({ cardIdentifier: 'c'.repeat(129), slot: 'mainboard' }).expect(400);
    await ask({ cardIdentifier: EMISSARY, slot: '' }).expect(400);
    await ask({ cardIdentifier: EMISSARY, slot: 's'.repeat(65) }).expect(400);
    // At the limits the request is valid and fails later as nothing to replace.
    await ask({ cardIdentifier: 'c'.repeat(128), slot: 'mainboard' }).expect(409);
    await ask({ cardIdentifier: EMISSARY, slot: 's'.repeat(64) }).expect(409);

    await fixture.get('/api/decks/not-a-number/alternatives', owner.jwt).query({ cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(400);
    await fixture.get('/api/decks/1.5/alternatives', owner.jwt).query({ cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(400);
  });

  it('returns no groups for hero and weapon slots', async () => {
    const owner = await fixture.scenario();

    for (const [cardIdentifier, slot] of [[TALISHAR, 'weapon'], [KATSU, 'hero']] as const) {
      for (const extra of [{}, { q: 'sink' }]) {
        const res = await alternatives(owner.jwt, owner.deckId, { cardIdentifier, slot, ...extra }).expect(200);
        expect(res.body.groups).toEqual([]);
        expect(res.body.needed).toBe(1);
      }
    }
  });

  it('reports owned copies and shows search results for a name: copies in two slots count both', async () => {
    const owner = await fixture.scenario([mainboard(COAX, 1), { cardIdentifier: COAX, quantity: 1, slot: 'equipment' }]);
    await fixture.own(owner.jwt, [{ cardIdentifier: EMISSARY, quantity: 1 }, { cardIdentifier: COAX, quantity: 3 }]);

    const res = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY, slot: 'mainboard', q: 'coax' }).expect(200);

    // needed 1: three in the deck after the pick is within the limit, and 3 owned minus 2 in the deck is 1 free.
    const coax = res.body.groups[0].cards.find((c: { cardIdentifier: string }) => c.cardIdentifier === COAX);
    expect(coax.freeCopies).toBe(1);

    const both = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: FLEX, slot: 'mainboard', q: 'coax' }).expect(200);
    // flex misses 2 copies: 2 in the deck plus 2 is over the limit, so coax is not listed.
    expect(both.body.groups.flatMap((g: { cards: Array<{ cardIdentifier: string }> }) => g.cards).some((c: { cardIdentifier: string }) => c.cardIdentifier === COAX)).toBe(false);
  });

  it('answers 409 NOTHING_TO_REPLACE when nothing is missing', async () => {
    const owner = await fixture.scenario();
    await fixture.own(owner.jwt, [{ cardIdentifier: EMISSARY, quantity: 2 }]);

    const owned = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: EMISSARY, slot: 'mainboard' }).expect(409);
    expect(owned.body.code).toBe('NOTHING_TO_REPLACE');

    const absent = await alternatives(owner.jwt, owner.deckId, { cardIdentifier: ADRENALINE, slot: 'mainboard' }).expect(409);
    expect(absent.body.code).toBe('NOTHING_TO_REPLACE');

    const other = await fixture.scenario();
    await fixture.post(`/api/decks/${other.deckId}/replacements`, other.jwt)
      .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'very_close' })
      .expect(201);
    const protectedCard = await alternatives(other.jwt, other.deckId, { cardIdentifier: COAX, slot: 'mainboard' }).expect(409);
    expect(protectedCard.body.code).toBe('NOTHING_TO_REPLACE');
  });

  it('answers a deck that is not the caller\'s like a missing deck', async () => {
    const owner = await fixture.scenario();
    const stranger = await fixture.signUp('stranger');
    const query = { cardIdentifier: EMISSARY, slot: 'mainboard' };

    const foreign = await alternatives(stranger.jwt, owner.deckId, query).expect(404);
    const missing = await alternatives(stranger.jwt, 2_000_000_000, query).expect(404);

    expect(withoutTimestamp(foreign.body)).toEqual(withoutTimestamp(missing.body));
  });
});

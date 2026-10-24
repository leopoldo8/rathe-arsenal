import {
  catalog,
  findCardLegalityViolation,
  getCopyLimit,
  scoreCandidate,
  TIER_1_CONFIG,
} from '@rathe-arsenal/engine';
import { bootFixture, EMISSARY, FLEX, IFixture, IScenario, KATSU, mainboard, TALISHAR } from './replacements-e2e.fixture';

const FORMAT = 'Classic Constructed';
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * The first two cards the engine would offer for both emissary and flex, in the order its index visits
 * them: with both owned, the earlier one is the suggestion for the first missing card that reaches it.
 */
function standIns(): readonly [string, string] {
  const hero = catalog.getCard(KATSU);
  const emissary = catalog.getCard(EMISSARY);
  const flex = catalog.getCard(FLEX);
  const fits = (missing: typeof emissary, candidate: typeof emissary): boolean => {
    const score = scoreCandidate(missing, candidate, TIER_1_CONFIG);
    return score !== null && score >= TIER_1_CONFIG.floorScore;
  };
  const found = (catalog.indices.byClassAndPitch.get('Generic:1') ?? []).filter(
    (card) =>
      card.cardIdentifier !== EMISSARY &&
      card.cardIdentifier !== FLEX &&
      findCardLegalityViolation(card, hero, FORMAT) === null &&
      getCopyLimit(card, FORMAT) === 3 &&
      fits(emissary, card) &&
      fits(flex, card),
  );
  if (found.length < 2) throw new Error('fewer than two shared stand-ins for emissary and flex');
  return [found[0]!.cardIdentifier, found[1]!.cardIdentifier];
}

const [FIRST, SECOND] = standIns();

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function newUlid(): string {
  return `01HP${Array.from({ length: 22 }, () => ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)]).join('')}`;
}

describe('suggestions from the collection (E2E)', () => {
  let fixture: IFixture;

  beforeAll(async () => {
    fixture = await bootFixture();
    // The migration drops this table; a database synchronize built for older code may still hold it.
    await fixture.dataSource.query(`DROP TABLE IF EXISTS swap_suggestion CASCADE`);
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  /** Emissary x2 suggests FIRST and flex x1 (one owned) suggests SECOND. */
  async function twoSuggestions(extraMainboard = [] as ReturnType<typeof mainboard>[], owned: Array<[string, number]> = []) {
    const owner = await fixture.scenario(extraMainboard);
    await fixture.own(owner.sessionToken, [
      { cardIdentifier: FLEX, quantity: 1 },
      { cardIdentifier: FIRST, quantity: 2 },
      { cardIdentifier: SECOND, quantity: 1 },
      ...owned.map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity })),
    ]);
    return owner;
  }

  async function suggestionsOf(owner: IScenario): Promise<Record<string, string>> {
    const detail = await fixture.get(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
    const suggestions: Record<string, string> = {};
    for (const entry of detail.body.latestSnapshot.breakdown.substituted) {
      suggestions[entry.original.cardIdentifier] ??= entry.match.substitute.cardIdentifier;
    }
    return suggestions;
  }

  function useSuggestion(owner: IScenario, original: string, replacement: string, pickedFrom = 'suggested') {
    return fixture
      .post(`/api/decks/${owner.deckId}/replacements`, owner.sessionToken)
      .send({ originalCardIdentifier: original, slot: 'mainboard', replacementCardIdentifier: replacement, pickedFrom });
  }

  function useAll(owner: IScenario) {
    return fixture.post(`/api/decks/${owner.deckId}/replacements/suggested`, owner.sessionToken);
  }

  it('the list and the deck read count the deck as it is', async () => {
    const owner = await twoSuggestions();
    expect(await suggestionsOf(owner)).toEqual({ [EMISSARY]: FIRST, [FLEX]: SECOND });

    const list = await fixture.get('/api/decks', owner.sessionToken).expect(200);
    const detail = await fixture.get(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);

    const listed = list.body.trackedDecks.find((deck: { id: number }) => deck.id === owner.deckId).latestSnapshot;
    expect(listed.effectivePercent).toBe(listed.rawPercent);
    const read = detail.body.latestSnapshot;
    expect(read.effectivePercent).toBe(read.rawPercent);
    expect(read.fidelityPercent).toBeGreaterThan(read.rawPercent);
    expect(read.breakdown.substituted).toHaveLength(3);
    for (const entry of read.breakdown.substituted) {
      expect(entry).not.toHaveProperty('approved');
    }
  });

  it('the first read after the truncate stores a fresh snapshot', async () => {
    const owner = await twoSuggestions();
    const scratch = await fixture
      .post('/api/decks', owner.sessionToken)
      .send({ heroIdentifier: KATSU, format: FORMAT })
      .expect(201);
    const deckIds = [owner.deckId, scratch.body.id as number];
    const clear = () =>
      fixture.dataSource.query(`DELETE FROM deck_readiness_snapshot WHERE "trackedDeckId" = ANY($1)`, [deckIds]);

    await clear();
    await fixture.get('/api/decks', owner.sessionToken).expect(200);
    expect([await fixture.snapshotCount(deckIds[0]!), await fixture.snapshotCount(deckIds[1]!)]).toEqual([1, 1]);

    await clear();
    await fixture.get(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
    expect(await fixture.snapshotCount(owner.deckId)).toBe(1);
  });

  it('a one-click use is a pick recorded as suggested', async () => {
    const owner = await fixture.scenario();
    await fixture.own(owner.sessionToken, [
      { cardIdentifier: FLEX, quantity: 2 },
      { cardIdentifier: FIRST, quantity: 2 },
    ]);
    expect((await suggestionsOf(owner))[EMISSARY]).toBe(FIRST);

    const res = await useSuggestion(owner, EMISSARY, FIRST).expect(201);

    expect(res.body.replacement).toEqual(
      expect.objectContaining({ pickedFrom: 'suggested', quantity: 2, status: 'active', replacementCardIdentifier: FIRST }),
    );
    const cards = await fixture.deckCards(owner.deckId);
    expect(cards[`${FIRST}@mainboard`]).toBe(2);
    expect(cards[`${EMISSARY}@mainboard`]).toBeUndefined();
    const rows = await fixture.replacementRows(owner.deckId);
    expect(rows.map((row) => [row['pickedFrom'], row['status']])).toEqual([['suggested', 'active']]);
    const detail = await fixture.get(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
    expect(detail.body.replacements).toEqual([
      expect.objectContaining({
        originalCardIdentifier: EMISSARY,
        originalName: 'Emissary of Tides',
        replacementCardIdentifier: FIRST,
        quantity: 2,
      }),
    ]);
  });

  it('a use moves every missing copy even when the collection covers fewer', async () => {
    const owner = await fixture.scenario();
    await fixture.own(owner.sessionToken, [
      { cardIdentifier: FLEX, quantity: 2 },
      { cardIdentifier: FIRST, quantity: 1 },
    ]);
    expect((await suggestionsOf(owner))[EMISSARY]).toBe(FIRST);

    const res = await useSuggestion(owner, EMISSARY, FIRST).expect(201);

    expect(res.body.replacement.quantity).toBe(2);
    expect((await fixture.deckCards(owner.deckId))[`${FIRST}@mainboard`]).toBe(2);
    const breakdown = await fixture.latestBreakdown(owner.deckId);
    expect(breakdown.exact).toEqual(expect.arrayContaining([expect.objectContaining({ cardIdentifier: FIRST, quantity: 1 })]));
    expect(breakdown.missing).toEqual(expect.arrayContaining([expect.objectContaining({ cardIdentifier: FIRST, quantity: 1 })]));
    expect(breakdown.substituted.filter((entry) => entry.original.cardIdentifier === FIRST)).toEqual([]);
  });

  it('accepts suggested and refuses swap as an origin', async () => {
    const owner = await fixture.scenario();
    await fixture.own(owner.sessionToken, [
      { cardIdentifier: FLEX, quantity: 2 },
      { cardIdentifier: FIRST, quantity: 2 },
    ]);
    const before = await fixture.deckCards(owner.deckId);

    await useSuggestion(owner, EMISSARY, FIRST, 'swap').expect(400);

    expect(await fixture.deckCards(owner.deckId)).toEqual(before);
    expect(await fixture.replacementRows(owner.deckId)).toEqual([]);
    await useSuggestion(owner, EMISSARY, FIRST).expect(201);
  });

  it('the bulk route uses every suggestion with one recompute', async () => {
    const owner = await twoSuggestions();
    const snapshotsBefore = await fixture.snapshotCount(owner.deckId);

    const res = await useAll(owner).expect(201);

    expect(res.body.skipped).toBe(0);
    expect(
      res.body.replacements.map((row: Record<string, unknown>) => [
        row['originalCardIdentifier'],
        row['replacementCardIdentifier'],
        row['quantity'],
        row['pickedFrom'],
        row['status'],
      ]),
    ).toEqual([
      [EMISSARY, FIRST, 2, 'suggested', 'active'],
      [FLEX, SECOND, 1, 'suggested', 'active'],
    ]);
    const cards = await fixture.deckCards(owner.deckId);
    expect([cards[`${EMISSARY}@mainboard`], cards[`${FIRST}@mainboard`], cards[`${FLEX}@mainboard`], cards[`${SECOND}@mainboard`]]).toEqual([
      undefined,
      2,
      1,
      1,
    ]);
    expect(await fixture.snapshotCount(owner.deckId)).toBe(snapshotsBefore + 1);
  });

  it('the bulk route refuses a deck with no suggestion', async () => {
    const owner = await fixture.scenario();
    const before = {
      cards: await fixture.deckCards(owner.deckId),
      snapshots: await fixture.snapshotCount(owner.deckId),
    };

    const res = await useAll(owner).expect(409);

    expect(res.body.code).toBe('NOTHING_TO_REPLACE');
    expect(await fixture.deckCards(owner.deckId)).toEqual(before.cards);
    expect(await fixture.replacementRows(owner.deckId)).toEqual([]);
    expect(await fixture.snapshotCount(owner.deckId)).toBe(before.snapshots);
  });

  it('the bulk route refuses when every suggestion is skipped', async () => {
    // Emissary's only suggestion would take FIRST from 2 copies in the deck to 4; flex is owned, so nothing else is suggested.
    const owner = await fixture.scenario([mainboard(FIRST, 2)]);
    await fixture.own(owner.sessionToken, [
      { cardIdentifier: FLEX, quantity: 2 },
      { cardIdentifier: FIRST, quantity: 4 },
    ]);
    expect(await suggestionsOf(owner)).toEqual({ [EMISSARY]: FIRST });
    const before = await fixture.deckCards(owner.deckId);

    const res = await useAll(owner).expect(409);

    expect(res.body.code).toBe('NOTHING_TO_REPLACE');
    expect(await fixture.deckCards(owner.deckId)).toEqual(before);
    expect(await fixture.replacementRows(owner.deckId)).toEqual([]);
  });

  it('the bulk route skips a suggestion past the copy limit and uses the others', async () => {
    // FIRST x2 in the deck and 4 owned: two free copies, both suggested for emissary, which would make 4.
    const owner = await twoSuggestions([mainboard(FIRST, 2)], [[FIRST, 2]]);
    expect(await suggestionsOf(owner)).toEqual({ [EMISSARY]: FIRST, [FLEX]: SECOND });

    const res = await useAll(owner).expect(201);

    expect(res.body.skipped).toBe(1);
    expect(res.body.replacements.map((row: Record<string, unknown>) => row['originalCardIdentifier'])).toEqual([FLEX]);
    expect((await fixture.deckCards(owner.deckId))[`${EMISSARY}@mainboard`]).toBe(2);
  });

  it('two bulk requests race and one finds nothing left', async () => {
    const owner = await twoSuggestions();

    const [first, second] = await Promise.all([useAll(owner), useAll(owner)]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect([first, second].find((res) => res.status === 409)!.body.code).toBe('NOTHING_TO_REPLACE');
    expect(await fixture.replacementRows(owner.deckId)).toHaveLength(2);
  });

  it('the bulk route refuses anonymous and foreign decks', async () => {
    const owner = await twoSuggestions();
    const stranger = await fixture.signUp('stranger');

    const { app } = fixture;
    const request = (await import('supertest')).default;
    await request(app.getHttpServer()).post(`/api/decks/${owner.deckId}/replacements/suggested`).expect(401);
    await fixture.post(`/api/decks/${owner.deckId}/replacements/suggested`, stranger.sessionToken).expect(404);
    await fixture.post('/api/decks/2147483000/replacements/suggested', owner.sessionToken).expect(404);
    expect(await fixture.replacementRows(owner.deckId)).toEqual([]);
  });

  it('the swaps routes are gone', async () => {
    const owner = await fixture.scenario();

    await fixture.get('/api/swaps', owner.sessionToken).expect(404);
    for (const action of ['approve', 'reject', 'revert', 'restore', 'outcome']) {
      await fixture.post(`/api/swaps/${RANDOM_UUID}/${action}`, owner.sessionToken).send({}).expect(404);
    }
  });

  it('every recompute path runs without a swap table', async () => {
    const [{ table }] = await fixture.dataSource.query(`SELECT to_regclass('swap_suggestion') AS table`);
    expect(table).toBeNull();

    const owner = await twoSuggestions();
    await fixture.get('/api/decks', owner.sessionToken).expect(200);
    await fixture.get(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
    await fixture
      .get(`/api/decks/${owner.deckId}/alternatives?cardIdentifier=${EMISSARY}&slot=mainboard`, owner.sessionToken)
      .expect(200);
    const picked = await useSuggestion(owner, EMISSARY, FIRST).expect(201);
    await fixture.post(`/api/replacements/${picked.body.replacement.id}/revert`, owner.sessionToken).expect(200);
    await useAll(owner).expect(201);
    await fixture.own(owner.sessionToken, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
    await fixture.post('/api/collection/mark-owned', owner.sessionToken).send({ deckId: owner.deckId, cardIdentifier: FLEX }).expect(201);
    await fixture
      .put(`/api/decks/${owner.deckId}`, owner.sessionToken)
      .send({
        heroIdentifier: KATSU,
        format: FORMAT,
        cards: [
          { cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' },
          { cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' },
        ],
      })
      .expect(200);
    // A second import that seeds the collection recomputes the owner's existing decks, and swallows a failed recompute.
    const snapshotsBeforeImport = await fixture.snapshotCount(owner.deckId);
    await fixture
      .post('/api/decks/import', owner.sessionToken)
      .send({ urls: [`https://fabrary.net/decks/${newUlid()}`], seedInventory: true })
      .expect(201);
    expect(await fixture.snapshotCount(owner.deckId)).toBe(snapshotsBeforeImport + 1);

    const [{ table: after }] = await fixture.dataSource.query(`SELECT to_regclass('swap_suggestion') AS table`);
    expect(after).toBeNull();
  });
});

import { SubstitutionService } from '../../substitution/substitution.service';
import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';

describe('PUT /api/decks/:deckId composition (E2E)', () => {
  let fixture: IFixture;
  let sessionToken: string;

  beforeAll(async () => {
    fixture = await bootFixture();
    ({ sessionToken } = await fixture.signUp('composition-save'));
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function createScratchDeck(heroIdentifier: string, format: string): Promise<{ id: number; name: string }> {
    const created = await fixture.post('/api/decks', sessionToken).send({ heroIdentifier, format }).expect(201);
    return { id: created.body.id as number, name: created.body.name as string };
  }

  function save(deckId: number, body: object) {
    return fixture.put(`/api/decks/${deckId}`, sessionToken).send(body);
  }

  it('a deck with problems is saved as is', async () => {
    const { id } = await createScratchDeck('rhinar', 'Blitz');

    const saved = await save(id, {
      heroIdentifier: 'rhinar',
      format: 'Blitz',
      cards: [{ cardIdentifier: 'pack-hunt-red', quantity: 2, slot: 'mainboard' }],
    }).expect(200);

    expect(saved.body.legality.category).toBe('illegal');
    expect(saved.body.legality.details).toContainEqual(
      expect.objectContaining({ code: 'too_many_copies', params: expect.objectContaining({ count: 2, limit: 1 }) }),
    );
    expect(await fixture.deckCards(id)).toEqual({ 'pack-hunt-red@mainboard': 2 });
    const read = await fixture.get(`/api/decks/${id}`, sessionToken).expect(200);
    expect(read.body.legality.category).toBe('illegal');
  });

  it('the automatic name follows the format a save changes', async () => {
    const { id, name } = await createScratchDeck('rhinar', 'Blitz');
    expect(name).toBe('Rhinar - Blitz');

    const saved = await save(id, { heroIdentifier: 'rhinar', format: 'Silver Age', cards: [] }).expect(200);

    expect(saved.body.name).toBe('Rhinar - Silver Age');
  });

  it('keeps a name the player chose when a save changes the format', async () => {
    const { id } = await createScratchDeck('rhinar', 'Blitz');
    await fixture.dataSource.query(`UPDATE tracked_deck SET name = 'Meu Rhinar' WHERE id = $1`, [id]);

    const saved = await save(id, { heroIdentifier: 'rhinar', format: 'Silver Age', cards: [] }).expect(200);

    expect(saved.body.name).toBe('Meu Rhinar');
  });
  it('the suggestions do not depend on where the database happens to keep the deck rows', async () => {
    const owned = [
      ['erase-face-red', 3],
      ['assault-and-battery-blue', 3],
      ['bloodrush-bellow-yellow', 3],
      ['cast-bones-red', 3],
      ['wild-ride-red', 3],
      ['savage-feast-red', 3],
      ['pulping-red', 3],
      ['send-packing-yellow', 3],
      ['wild-ride-yellow', 3],
      ['riled-up-blue', 3],
      ['smash-instinct-blue', 3],
      ['run-roughshod-blue', 3],
    ] as const;
    const wanted = [...owned.slice(3), ['brothers-in-arms-red', 3], ['bear-hug-blue', 1], ['argh-smash-yellow', 1]] as const;
    const { sessionToken: token } = await fixture.signUp('composition-order');
    await fixture.own(token, owned.map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity })));
    const created = await fixture
      .post('/api/decks', token)
      .send({ heroIdentifier: 'rhinar-reckless-rampage', format: 'Classic Constructed' })
      .expect(201);
    const id = created.body.id as number;
    await fixture.put(`/api/decks/${id}`, token)
      .send({
        heroIdentifier: 'rhinar-reckless-rampage',
        format: 'Classic Constructed',
        cards: wanted.map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity, slot: 'mainboard' })),
      })
      .expect(200);
    const before = (await fixture.latestBreakdown(id)).substituted.length;
    const rows = await fixture.dataSource.query<Array<{ userId: string }>>(
      'SELECT "userId" FROM tracked_deck WHERE id = $1',
      [id],
    );
    const userId = rows[0]?.userId ?? '';

    // An UPDATE writes a new row version after the others, which is where a
    // table scan then returns it; the same happens after vacuum reuses space.
    await fixture.dataSource.query(
      `UPDATE deck_card SET quantity = quantity WHERE "trackedDeckId" = $1 AND "cardIdentifier" = 'brothers-in-arms-red'`,
      [id],
    );
    await fixture.app.get(SubstitutionService).computeAndStoreReadiness(id, userId);

    expect(before).toBeGreaterThanOrEqual(3);
    expect((await fixture.latestBreakdown(id)).substituted.length).toBe(before);
  });
});

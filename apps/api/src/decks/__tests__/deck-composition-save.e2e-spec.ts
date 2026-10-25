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
});

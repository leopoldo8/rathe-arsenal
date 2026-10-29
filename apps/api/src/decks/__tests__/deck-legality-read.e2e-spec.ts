import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';

describe('deck legality on read (E2E)', () => {
  let fixture: IFixture;
  let sessionToken: string;

  beforeAll(async () => {
    fixture = await bootFixture();
    ({ sessionToken } = await fixture.signUp('legality-read'));
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function createScratchDeck(heroIdentifier: string, format: string): Promise<number> {
    const created = await fixture.post('/api/decks', sessionToken).send({ heroIdentifier, format }).expect(201);
    return created.body.id as number;
  }

  it('a format outside the four is stored and read as unchecked', async () => {
    const deckId = await createScratchDeck('katsu-the-wanderer', 'Classic Constructed');
    await fixture.dataSource.query(`UPDATE tracked_deck SET format = 'Draft' WHERE id = $1`, [deckId]);

    const detail = await fixture.get(`/api/decks/${deckId}`, sessionToken).expect(200);
    const list = await fixture.get('/api/decks', sessionToken).expect(200);

    expect(detail.body.format).toBe('Draft');
    expect(detail.body.legality).toEqual({ category: 'unchecked', reasons: [], details: [] });
    const listed = (list.body.trackedDecks as Array<{ id: number; format: string; legality: { category: string } }>).find(
      (deck) => deck.id === deckId,
    );
    expect(listed).toMatchObject({ format: 'Draft', legality: { category: 'unchecked' } });
  });

  it('a saved blitz 2-of is illegal on the next read', async () => {
    const deckId = await createScratchDeck('rhinar', 'Blitz');
    await fixture.dataSource.query(
      `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", slot, quantity) VALUES ($1, 'pack-hunt-red', 'mainboard', 2)`,
      [deckId],
    );

    const detail = await fixture.get(`/api/decks/${deckId}`, sessionToken).expect(200);

    expect(detail.body.legality.category).toBe('illegal');
    expect(detail.body.legality.details).toContainEqual({
      code: 'too_many_copies',
      params: {
        card: 'Pack Hunt',
        cardIdentifier: 'pack-hunt-red',
        pitch: 1,
        count: 2,
        limit: 1,
        format: 'Blitz',
        legendary: false,
        restricted: false,
      },
    });
  });
});

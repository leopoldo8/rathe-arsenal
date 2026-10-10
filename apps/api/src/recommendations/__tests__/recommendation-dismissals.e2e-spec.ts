import { Logger } from '@nestjs/common';
import { bootRecommendationsFixture, IRecommendationsFixture } from './recommendations-e2e.fixture';

const CARD = 'adrenaline-rush-red';

describe('recommendation dismissals (e2e)', () => {
  let fixture: IRecommendationsFixture;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture();
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function dismissals(deckId: number): Promise<Array<{ cardIdentifier: string }>> {
    return fixture.dataSource.query(`SELECT * FROM recommendation_dismissal WHERE "trackedDeckId" = $1`, [deckId]);
  }

  it('dismisses once and answers a repeat with 200', async () => {
    const { jwt, deckId } = await fixture.scenario();

    const first = await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: CARD }).expect(201);
    const repeat = await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: CARD }).expect(200);

    expect(first.body.dismissal).toEqual({ cardIdentifier: CARD, createdAt: expect.any(String) });
    expect(repeat.body.dismissal).toEqual(first.body.dismissal);
    expect(await dismissals(deckId)).toHaveLength(1);
  });

  it('refuses malformed dismissals', async () => {
    const { jwt, deckId } = await fixture.scenario();
    for (const body of [{}, { cardIdentifier: 'x'.repeat(129) }, { cardIdentifier: 'not-a-card' }]) {
      const response = await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send(body);
      expect({ body, status: response.status }).toEqual({ body, status: 400 });
    }
    expect(await dismissals(deckId)).toHaveLength(0);
  });

  it('undo answers 204 whether or not a dismissal existed', async () => {
    const { jwt, deckId } = await fixture.scenario();
    await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: CARD }).expect(201);

    await fixture.del(`/api/decks/${deckId}/recommendations/dismissals/${CARD}`, jwt).expect(204);
    expect(await dismissals(deckId)).toHaveLength(0);
    await fixture.del(`/api/decks/${deckId}/recommendations/dismissals/${CARD}`, jwt).expect(204);
  });

  it('refuses foreign, malformed and anonymous dismissals', async () => {
    const { jwt, deckId } = await fixture.scenario();
    const stranger = await fixture.signUp('stranger');

    await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, stranger.jwt).send({ cardIdentifier: CARD }).expect(404);
    await fixture.del(`/api/decks/${deckId}/recommendations/dismissals/${CARD}`, stranger.jwt).expect(404);
    await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, '').send({ cardIdentifier: CARD }).expect(401);
    await fixture.del(`/api/decks/${deckId}/recommendations/dismissals/${CARD}`, '').expect(401);
    await fixture.post(`/api/decks/abc/recommendations/dismissals`, jwt).send({ cardIdentifier: CARD }).expect(400);
    await fixture.del(`/api/decks/abc/recommendations/dismissals/${CARD}`, jwt).expect(400);
    await fixture.del(`/api/decks/${deckId}/recommendations/dismissals/${'x'.repeat(129)}`, jwt).expect(400);
    expect(await dismissals(deckId)).toHaveLength(0);
  });

  it('logs dismiss and undo', async () => {
    const { jwt, deckId } = await fixture.scenario();
    const log = jest.spyOn(Logger.prototype, 'log');
    try {
      await fixture.post(`/api/decks/${deckId}/recommendations/dismissals`, jwt).send({ cardIdentifier: CARD }).expect(201);
      await fixture.del(`/api/decks/${deckId}/recommendations/dismissals/${CARD}`, jwt).expect(204);

      expect(log).toHaveBeenCalledWith({ event: 'recommendations.dismissed', trackedDeckId: deckId, cardIdentifier: CARD });
      expect(log).toHaveBeenCalledWith({ event: 'recommendations.undismissed', trackedDeckId: deckId, cardIdentifier: CARD });
    } finally {
      log.mockRestore();
    }
  });
});

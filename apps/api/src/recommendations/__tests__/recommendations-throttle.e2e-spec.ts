import { bootRecommendationsFixture, FLEX, IRecommendationsFixture } from './recommendations-e2e.fixture';

const GLOBAL_LIMIT_PER_MINUTE = 120;
const GENERATE_LIMIT_PER_MINUTE = 10;
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

describe('recommendation routes under the throttler (e2e)', () => {
  let fixture: IRecommendationsFixture;

  beforeAll(async () => {
    fixture = await bootRecommendationsFixture({ throttle: true });
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  async function statusesOf(send: () => PromiseLike<{ status: number }>, count: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < count; attempt += 1) statuses.push((await send()).status);
    return statuses;
  }

  it(
    'every recommendations route is throttled',
    async () => {
      const owner = await fixture.scenario();
      const base = `/api/decks/${owner.deckId}/recommendations`;
      const routes: ReadonlyArray<readonly [string, () => PromiseLike<{ status: number }>]> = [
        ['read', () => fixture.get(base, owner.jwt)],
        ['dismiss', () => fixture.post(`${base}/dismissals`, owner.jwt).send({ cardIdentifier: 'not-a-card' })],
        ['undismiss', () => fixture.del(`${base}/dismissals/adrenaline-rush-red`, owner.jwt)],
        ['adopt', () => fixture.post(`${base}/${RANDOM_UUID}/adopt`, owner.jwt).send({ cutCardIdentifier: FLEX, cutSlot: 'mainboard' })],
        ['deck list', () => fixture.get('/api/decks', owner.jwt)],
      ];

      for (const [label, send] of routes) {
        const statuses = await statusesOf(send, GLOBAL_LIMIT_PER_MINUTE + 1);
        expect({ label, throttledEarly: statuses.slice(0, GLOBAL_LIMIT_PER_MINUTE).includes(429) }).toEqual({ label, throttledEarly: false });
        expect({ label, last: statuses[GLOBAL_LIMIT_PER_MINUTE] }).toEqual({ label, last: 429 });
      }
    },
    240_000,
  );

  it('Generate allows 10 requests a minute', async () => {
    const owner = await fixture.scenario();

    const statuses = await statusesOf(
      () => fixture.post(`/api/decks/${owner.deckId}/recommendations/runs`, owner.jwt),
      GENERATE_LIMIT_PER_MINUTE + 1,
    );

    expect(statuses.slice(0, GENERATE_LIMIT_PER_MINUTE)).toEqual(Array(GENERATE_LIMIT_PER_MINUTE).fill(202));
    expect(statuses[GENERATE_LIMIT_PER_MINUTE]).toBe(429);
  });
});

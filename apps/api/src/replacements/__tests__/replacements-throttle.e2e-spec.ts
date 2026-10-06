import { bootFixture, COAX, EMISSARY, IFixture } from './replacements-e2e.fixture';

const GLOBAL_LIMIT_PER_MINUTE = 120;
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

describe('replacement routes under the global throttler (E2E)', () => {
  let fixture: IFixture;

  beforeAll(async () => {
    fixture = await bootFixture({ throttle: true });
  }, 60_000);

  afterAll(async () => {
    await fixture?.close();
  });

  it(
    'throttles the replacement routes',
    async () => {
      const owner = await fixture.scenario();
      const pickBody = {
        originalCardIdentifier: EMISSARY,
        slot: 'mainboard',
        replacementCardIdentifier: COAX,
        pickedFrom: 'very_close',
      };
      const routes: ReadonlyArray<readonly [string, () => ReturnType<IFixture['get']>]> = [
        ['alternatives', () => fixture.get(`/api/decks/${owner.deckId}/alternatives`, owner.jwt).query({ cardIdentifier: 'x', slot: 'mainboard', q: 'a' })],
        ['pick', () => fixture.post(`/api/decks/${owner.deckId}/replacements`, owner.jwt).send({ ...pickBody, slot: 'weapon' })],
        ['revert', () => fixture.post(`/api/replacements/${RANDOM_UUID}/revert`, owner.jwt)],
        ['keep', () => fixture.post(`/api/replacements/${RANDOM_UUID}/keep`, owner.jwt)],
        ['deck detail', () => fixture.get(`/api/decks/${owner.deckId}`, owner.jwt)],
      ];

      for (const [label, send] of routes) {
        const statuses: number[] = [];
        for (let attempt = 0; attempt <= GLOBAL_LIMIT_PER_MINUTE; attempt += 1) {
          statuses.push((await send()).status);
        }
        expect({ label, throttledEarly: statuses.slice(0, GLOBAL_LIMIT_PER_MINUTE).includes(429) }).toEqual({
          label,
          throttledEarly: false,
        });
        expect({ label, last: statuses[GLOBAL_LIMIT_PER_MINUTE] }).toEqual({ label, last: 429 });
      }
    },
    240_000,
  );
});

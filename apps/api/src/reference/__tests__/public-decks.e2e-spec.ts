import { Logger } from '@nestjs/common';
import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { FabraryService } from '../../fabrary/fabrary.service';
import { authorKeyOf } from '../../recommendations/public-deck-usage';
import { FabraryIndexClient, IIndexDeck, IIndexRequest, IIndexResult } from '../fabrary-index';
import { PUBLIC_DECKS_RETRY_MS, PUBLIC_DECKS_TTL_MS, PublicDecksService } from '../public-decks.service';

const HERO = 'kayo-armed-and-dangerous';
const FORMAT = 'Living Legend';
const T0 = new Date('2026-11-02T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function ulid(index: number): string {
  return `01JPVB${String(index).padStart(20, '0')}`;
}

function hit(index: number): IIndexDeck {
  return {
    deckId: ulid(index),
    name: `Kayo ${index}`,
    format: FORMAT,
    heroIdentifier: HERO,
    updatedAt: new Date(T0.getTime() - (index + 1) * DAY_MS).toISOString(),
    userId: `author-${index}`,
  };
}

function fetched(deckId: string): IDeckImportDto {
  const berserk = Number(deckId.slice(-1)) < 4 ? [{ cardIdentifier: 'berserk-yellow', quantity: 3, slot: 'mainboard' as const }] : [];
  return {
    ulid: deckId,
    name: 'n',
    format: FORMAT,
    hero: { cardIdentifier: HERO, name: 'Kayo' },
    mainboard: [...berserk, { cardIdentifier: 'pulping-red', quantity: 40, slot: 'mainboard' }],
    equipment: [],
    weapons: [{ cardIdentifier: 'mandible-claw', quantity: 1, slot: 'weapon' }],
    inventory: [{ cardIdentifier: 'pulping-yellow', quantity: 3, slot: 'mainboard' }],
  };
}

describe('public decks for the usage signal (E2E)', () => {
  let fixture: IFixture;
  let service: PublicDecksService;
  let fabrary: jest.Mocked<FabraryService>;
  let indexCalls: IIndexRequest[];
  let indexFails: boolean;

  beforeAll(async () => {
    fixture = await bootFixture();
    service = fixture.app.get(PublicDecksService);
    fabrary = fixture.app.get(FabraryService) as jest.Mocked<FabraryService>;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    (fixture.app.get(FabraryIndexClient) as unknown as { query: (r: IIndexRequest) => Promise<IIndexResult> }).query = async (request) => {
      indexCalls.push(request);
      if (indexFails) throw new Error('index down');
      const hits = Array.from({ length: 5 }, (_, index) => hit(index));
      return { nbHits: hits.length, hits };
    };
  }, 60_000);

  afterAll(async () => {
    await fixture.dataSource.query(`DELETE FROM public_deck WHERE "heroIdentifier" = $1`, [HERO]);
    await fixture.dataSource.query(`DELETE FROM public_deck_refresh WHERE "heroIdentifier" = $1`, [HERO]);
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.dataSource.query(`DELETE FROM public_deck WHERE "heroIdentifier" = $1`, [HERO]);
    await fixture.dataSource.query(`DELETE FROM public_deck_refresh WHERE "heroIdentifier" = $1`, [HERO]);
    (service as unknown as { retryNotBefore: Map<string, number> }).retryNotBefore.clear();
    indexCalls = [];
    indexFails = false;
    fabrary.fetchDeck.mockReset();
    fabrary.fetchDeck.mockImplementation(async (id: string) => fetched(id));
  });

  it('reads the decks from Fabrary once, stores ids, a hashed author and playable cards, and answers from the store until the TTL', async () => {
    // Act
    const first = await service.usage(HERO, FORMAT, T0);
    const second = await service.usage(HERO, FORMAT, new Date(T0.getTime() + PUBLIC_DECKS_TTL_MS - 1));

    // Assert
    expect(first?.source).toBe('public');
    expect(first?.decks).toBe(5);
    expect(first?.shares.get('berserk-yellow')).toBeCloseTo(0.8);
    expect(first?.shares.has('pulping-yellow')).toBe(false);
    expect(second?.decks).toBe(5);
    expect(indexCalls).toHaveLength(1);
    expect(fabrary.fetchDeck).toHaveBeenCalledTimes(5);
    const [stored] = await fixture.dataSource.query(`SELECT * FROM public_deck WHERE "fabraryUlid" = $1`, [ulid(0)]);
    expect(stored.authorKey).toBe(authorKeyOf('author-0', ulid(0)));
    expect(JSON.stringify(stored)).not.toContain('author-0');
    const cards = await fixture.dataSource.query(
      `SELECT c."cardIdentifier", c.quantity FROM public_deck_card c JOIN public_deck d ON d.id = c."publicDeckId" WHERE d."fabraryUlid" = $1 ORDER BY 1`,
      [ulid(0)],
    );
    expect(cards).toEqual([
      { cardIdentifier: 'berserk-yellow', quantity: 3 },
      { cardIdentifier: 'mandible-claw', quantity: 1 },
      { cardIdentifier: 'pulping-red', quantity: 40 },
    ]);
  });

  it('after the TTL asks the index again and fetches only the decks edited since', async () => {
    await service.usage(HERO, FORMAT, T0);
    fabrary.fetchDeck.mockClear();

    await service.usage(HERO, FORMAT, new Date(T0.getTime() + PUBLIC_DECKS_TTL_MS + 1));

    expect(indexCalls).toHaveLength(2);
    expect(fabrary.fetchDeck).not.toHaveBeenCalled();
  });

  it('a failed refresh answers from the stored decks and waits before asking Fabrary again', async () => {
    // Arrange
    await service.usage(HERO, FORMAT, T0);
    indexFails = true;
    const later = new Date(T0.getTime() + PUBLIC_DECKS_TTL_MS + 1);

    // Act
    const stale = await service.usage(HERO, FORMAT, later);
    await service.usage(HERO, FORMAT, new Date(later.getTime() + PUBLIC_DECKS_RETRY_MS - 1));

    // Assert
    expect(stale?.decks).toBe(5);
    expect(indexCalls).toHaveLength(2);
  });

  it('gives no signal when Fabrary is down and nothing is stored', async () => {
    indexFails = true;

    expect(await service.usage(HERO, FORMAT, T0)).toBeNull();
  });
});

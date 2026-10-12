import { Logger } from '@nestjs/common';
import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';
import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { FabraryService } from '../../fabrary/fabrary.service';
import { FabraryIndexClient, IIndexDeck, IIndexRequest, IIndexResult } from '../fabrary-index';
import { ISyncClock, TournamentSyncService } from '../tournament-sync.service';

const HOUR = 60 * 60 * 1000;
const T0 = new Date('2026-10-11T12:00:00.000Z');

function listed(deckId: string, name = `Calling: Pelotas ${deckId.slice(-1)}th`): IIndexDeck {
  return { deckId, name, format: 'Classic Constructed', heroIdentifier: 'katsu-the-wanderer' };
}

function fetched(ulid: string): IDeckImportDto {
  return {
    ulid,
    name: 'n',
    format: 'Classic Constructed',
    hero: { cardIdentifier: 'katsu-the-wanderer', name: 'Katsu' },
    mainboard: [{ cardIdentifier: 'flex-red', quantity: 2, slot: 'mainboard' }],
    equipment: [],
    weapons: [{ cardIdentifier: 'talishar-the-lost-prince', quantity: 1, slot: 'weapon' }],
    inventory: [{ cardIdentifier: 'flex-red', quantity: 1, slot: 'mainboard' }],
  };
}

function ulid(n: number): string {
  return `01M441KWV10XFZDC1ZJ4589A${String(n).padStart(2, '0')}`;
}

describe('tournament deck sync (E2E)', () => {
  let fixture: IFixture;
  let service: TournamentSyncService;
  let index: FabraryIndexClient;
  let fabrary: jest.Mocked<FabraryService>;
  let listing: IIndexDeck[];

  function clock(start: Date = T0): ISyncClock & { sleeps: number[] } {
    const sleeps: number[] = [];
    let now = start.getTime();
    return {
      sleeps,
      now: () => new Date(now),
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    };
  }

  async function rows(): Promise<Array<Record<string, unknown>>> {
    return fixture.dataSource.query(`SELECT * FROM tournament_deck ORDER BY "fabraryUlid"`);
  }

  beforeAll(async () => {
    fixture = await bootFixture();
    service = fixture.app.get(TournamentSyncService);
    index = fixture.app.get(FabraryIndexClient);
    fabrary = fixture.app.get(FabraryService) as jest.Mocked<FabraryService>;
  }, 60_000);

  afterAll(async () => {
    await fixture.dataSource.query(`DELETE FROM tournament_deck`);
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.dataSource.query(`DELETE FROM tournament_deck`);
    (service as unknown as { retryNotBefore: number }).retryNotBefore = 0;
    listing = [listed(ulid(1)), listed(ulid(2)), listed(ulid(3))];
    (index as unknown as { query: (r: IIndexRequest) => Promise<IIndexResult> }).query = async (request) => {
      if (request.facets?.[0] === 'format') {
        return { nbHits: listing.length, hits: [], facets: { format: { 'Classic Constructed': listing.length } } };
      }
      if (request.facets?.[0] === 'heroIdentifier') {
        return { nbHits: listing.length, hits: [], facets: { heroIdentifier: { 'katsu-the-wanderer': listing.length } } };
      }
      return { nbHits: listing.length, hits: listing };
    };
    fabrary.fetchDeck.mockReset();
    fabrary.fetchDeck.mockImplementation(async (id: string) => fetched(id));
  });

  it('syncs when empty or a day old, never sooner', async () => {
    expect(await service.isDue(T0)).toBe(true);
    await service.sync(clock());
    (service as unknown as { retryNotBefore: number }).retryNotBefore = 0;

    expect(await service.isDue(new Date(T0.getTime() + 23 * HOUR))).toBe(false);
    expect(await service.isDue(new Date(T0.getTime() + 25 * HOUR))).toBe(true);
  });

  it('stores new decks with their cards, paced', async () => {
    const fake = clock();

    await service.sync(fake);

    expect((await rows()).map((row) => row['fabraryUlid'])).toEqual([ulid(1), ulid(2), ulid(3)]);
    expect(fabrary.fetchDeck).toHaveBeenCalledTimes(3);
    expect(fake.sleeps).toEqual([300, 300]);
    const cards: Array<Record<string, unknown>> = await fixture.dataSource.query(
      `SELECT c."cardIdentifier", c.quantity, c."sideboardQuantity" FROM tournament_deck_card c
         JOIN tournament_deck d ON d.id = c."tournamentDeckId" WHERE d."fabraryUlid" = $1 ORDER BY c."cardIdentifier"`,
      [ulid(1)],
    );
    expect(cards).toEqual([
      { cardIdentifier: 'flex-red', quantity: 2, sideboardQuantity: 1 },
      { cardIdentifier: 'talishar-the-lost-prince', quantity: 1, sideboardQuantity: 0 },
    ]);
  });

  it('a known deck is touched, not fetched', async () => {
    await service.sync(clock());
    fabrary.fetchDeck.mockClear();
    const later = new Date(T0.getTime() + 25 * HOUR);

    await service.sync(clock(later));

    expect(fabrary.fetchDeck).not.toHaveBeenCalled();
    expect((await rows()).map((row) => (row['syncedAt'] as Date).toISOString())).toEqual([
      later.toISOString(),
      later.toISOString(),
      later.toISOString(),
    ]);
  });

  it('an unparsed name is stored with no placement', async () => {
    listing = [listed(ulid(1), 'My spicy brew'), listed(ulid(2), 'Calling: São Paulo 5th 🇧🇷')];

    await service.sync(clock());

    expect((await rows()).map((row) => [row['name'], row['eventName'], row['placement']])).toEqual([
      ['My spicy brew', null, null],
      ['Calling: São Paulo 5th 🇧🇷', 'Calling: São Paulo', 5],
    ]);
  });

  it('a failed deck is skipped and fetched next time', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');
    fabrary.fetchDeck.mockImplementation(async (id: string) => {
      if (id === ulid(2)) throw new Error('getDeck failed');
      return fetched(id);
    });

    await service.sync(clock());

    expect((await rows()).map((row) => row['fabraryUlid'])).toEqual([ulid(1), ulid(3)]);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'tournament.sync.deck_failed', fabraryUlid: ulid(2) }));
    fabrary.fetchDeck.mockClear();
    fabrary.fetchDeck.mockImplementation(async (id: string) => fetched(id));

    await service.sync(clock(new Date(T0.getTime() + 25 * HOUR)));

    expect(fabrary.fetchDeck.mock.calls.map((call) => call[0])).toEqual([ulid(2)]);
    warn.mockRestore();
  });

  it('an index failure stores nothing and waits an hour', async () => {
    const error = jest.spyOn(Logger.prototype, 'error');
    (index as unknown as { query: () => Promise<IIndexResult> }).query = async () => {
      throw new Error('index down');
    };

    expect(await service.sync(clock())).toBeNull();

    expect(await rows()).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ event: 'tournament.sync.failed' }));
    expect(await service.isDue(new Date(T0.getTime() + 59 * 60 * 1000))).toBe(false);
    expect(await service.isDue(new Date(T0.getTime() + 61 * 60 * 1000))).toBe(true);
    error.mockRestore();
  });

  it('a truncated listing is logged and kept', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const many = Array.from({ length: 1000 }, (_, i) => listed(`01M441KWV10XFZDC1ZJ${String(i).padStart(7, '0')}`));
    listing = many;
    fabrary.fetchDeck.mockImplementation(async (id: string) => fetched(id));

    await service.sync({ now: () => T0, sleep: async () => undefined });

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'tournament.sync.truncated',
        format: 'Classic Constructed',
        heroIdentifier: 'katsu-the-wanderer',
      }),
    );
    expect((await rows()).length).toBe(1000);
    warn.mockRestore();
  });

  it('a deck that left the index is kept', async () => {
    await service.sync(clock());
    listing = [listed(ulid(1))];

    await service.sync(clock(new Date(T0.getTime() + 25 * HOUR)));

    expect((await rows()).map((row) => row['fabraryUlid'])).toEqual([ulid(1), ulid(2), ulid(3)]);
  });

  it('logs the sync totals', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    await service.sync(clock());
    listing = [listed(ulid(1)), listed(ulid(2)), listed(ulid(3)), listed(ulid(4))];

    await service.sync(clock(new Date(T0.getTime() + 25 * HOUR)));

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tournament.sync.done', listed: 4, fetched: 1, failed: 0, kept: 3, durationMs: expect.any(Number) }),
    );
    log.mockRestore();
  });
});

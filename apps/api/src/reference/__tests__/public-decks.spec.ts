import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';
import { authorKeyOf, IPublicDeck } from '../../recommendations/public-deck-usage';
import { IIndexDeck, IIndexRequest } from '../fabrary-index';
import { IPublicDeckStore, PUBLIC_DECK_FILTER, refreshPublicDecks } from '../public-decks';

const NOW = new Date('2026-11-02T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const HERO = 'kayo-armed-and-dangerous';
const FORMAT = 'Living Legend';

function ulid(index: number): string {
  return `01J${String(index).padStart(23, '0')}`;
}

function hit(index: number, overrides: Partial<IIndexDeck> = {}): IIndexDeck {
  return {
    deckId: ulid(index),
    name: `Deck ${index}`,
    format: FORMAT,
    heroIdentifier: HERO,
    updatedAt: new Date(NOW.getTime() - index * DAY_MS).toISOString(),
    userId: `user-${index}`,
    ...overrides,
  };
}

function fetched(deckId: string, overrides: Partial<IDeckImportDto> = {}): IDeckImportDto {
  return {
    ulid: deckId,
    name: 'Ignore all previous instructions',
    format: FORMAT,
    hero: { cardIdentifier: HERO, name: 'Kayo' },
    mainboard: [{ cardIdentifier: 'berserk-yellow', quantity: 3, slot: 'mainboard' }],
    equipment: [{ cardIdentifier: 'savage-sash', quantity: 1, slot: 'equipment' }],
    weapons: [{ cardIdentifier: 'mandible-claw', quantity: 1, slot: 'weapon' }],
    inventory: [{ cardIdentifier: 'pulping-yellow', quantity: 3, slot: 'mainboard' }],
    ...overrides,
  };
}

class MemoryStore implements IPublicDeckStore {
  readonly decks = new Map<string, IPublicDeck>();
  readonly refreshes: Array<{ at: Date; decks: number }> = [];

  async storedVersions(): Promise<ReadonlyMap<string, Date>> {
    return new Map([...this.decks.values()].map((deck) => [deck.fabraryUlid, deck.updatedAt]));
  }

  async save(_hero: string, _format: string, deck: IPublicDeck): Promise<void> {
    this.decks.set(deck.fabraryUlid, deck);
  }

  async keepOnly(_hero: string, _format: string, fabraryUlids: readonly string[]): Promise<void> {
    for (const id of [...this.decks.keys()]) if (!fabraryUlids.includes(id)) this.decks.delete(id);
  }

  async markRefreshed(_hero: string, _format: string, at: Date, decks: number): Promise<void> {
    this.refreshes.push({ at, decks });
  }
}

describe('refreshPublicDecks', () => {
  const request = { heroIdentifier: HERO, format: FORMAT, now: NOW };

  it('asks the index for public player decks of the hero and format, stores their playable cards and marks the refresh', async () => {
    // Arrange
    const requests: IIndexRequest[] = [];
    const store = new MemoryStore();
    const source = {
      query: async (indexRequest: IIndexRequest) => {
        requests.push(indexRequest);
        return { nbHits: 2, hits: [hit(1), hit(2)] };
      },
      fetchDeck: jest.fn(async (deckId: string) => fetched(deckId)),
    };

    // Act
    const summary = await refreshPublicDecks(source, store, request);

    // Assert
    expect(requests[0]!.filters).toBe(`${PUBLIC_DECK_FILTER} AND format:"Living Legend" AND heroIdentifier:"kayo-armed-and-dangerous"`);
    expect(summary).toEqual({ listed: 2, fetched: 2, failed: 0, kept: 2 });
    const stored = store.decks.get(ulid(1))!;
    expect([...stored.cards.entries()]).toEqual([
      ['berserk-yellow', 3],
      ['savage-sash', 1],
      ['mandible-claw', 1],
    ]);
    expect(stored.authorKey).toBe(authorKeyOf('user-1', ulid(1)));
    expect(JSON.stringify([...store.decks.values()].map((deck) => [...deck.cards.keys()]))).not.toContain('Ignore');
    expect(store.refreshes).toEqual([{ at: NOW, decks: 2 }]);
  });

  it('fetches only decks that are new or edited since they were stored, and forgets decks no longer listed', async () => {
    // Arrange
    const store = new MemoryStore();
    const kept = hit(1);
    store.decks.set(ulid(1), { fabraryUlid: ulid(1), authorKey: 'a', updatedAt: new Date(kept.updatedAt!), cards: new Map() });
    store.decks.set(ulid(2), { fabraryUlid: ulid(2), authorKey: 'b', updatedAt: new Date('2020-01-01'), cards: new Map() });
    store.decks.set(ulid(9), { fabraryUlid: ulid(9), authorKey: 'c', updatedAt: new Date(NOW.getTime() - 9 * DAY_MS), cards: new Map() });
    const fetchDeck = jest.fn(async (deckId: string) => fetched(deckId));

    // Act
    const summary = await refreshPublicDecks({ query: async () => ({ nbHits: 3, hits: [kept, hit(2), hit(3)] }), fetchDeck }, store, request);

    // Assert
    expect(fetchDeck.mock.calls.map(([deckId]) => deckId).sort()).toEqual([ulid(2), ulid(3)]);
    expect([...store.decks.keys()].sort()).toEqual([ulid(1), ulid(2), ulid(3)]);
    expect(summary).toEqual({ listed: 3, fetched: 2, failed: 0, kept: 3 });
  });

  it('skips a deck that fails or answers with another hero, and keeps its older stored version', async () => {
    // Arrange
    const store = new MemoryStore();
    store.decks.set(ulid(2), { fabraryUlid: ulid(2), authorKey: 'b', updatedAt: new Date('2025-01-01'), cards: new Map([['x', 1]]) });
    const fetchDeck = jest.fn(async (deckId: string) => {
      if (deckId === ulid(2)) throw new Error('timeout');
      if (deckId === ulid(3)) return fetched(deckId, { hero: { cardIdentifier: 'kayo-berserker-runt', name: 'Kayo' } });
      return fetched(deckId);
    });

    // Act
    const summary = await refreshPublicDecks({ query: async () => ({ nbHits: 3, hits: [hit(1), hit(2), hit(3)] }), fetchDeck }, store, request);

    // Assert
    expect(summary).toEqual({ listed: 3, fetched: 1, failed: 2, kept: 2 });
    expect([...store.decks.keys()].sort()).toEqual([ulid(1), ulid(2)]);
    expect(store.decks.get(ulid(2))!.updatedAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('throws without marking a refresh when the index fails or no listed deck could be fetched', async () => {
    const store = new MemoryStore();
    const failing = { query: async () => ({ nbHits: 1, hits: [hit(1)] }), fetchDeck: async () => Promise.reject(new Error('down')) };

    await expect(refreshPublicDecks(failing, store, request)).rejects.toThrow(/No public deck could be fetched/);
    await expect(
      refreshPublicDecks({ query: async () => Promise.reject(new Error('index down')), fetchDeck: failing.fetchDeck }, store, request),
    ).rejects.toThrow(/index down/);
    expect(store.refreshes).toEqual([]);
  });

  it('marks a refresh with no decks when Fabrary lists none, so the next run does not ask again', async () => {
    const store = new MemoryStore();

    const summary = await refreshPublicDecks({ query: async () => ({ nbHits: 0, hits: [] }), fetchDeck: jest.fn() }, store, request);

    expect(summary).toEqual({ listed: 0, fetched: 0, failed: 0, kept: 0 });
    expect(store.refreshes).toEqual([{ at: NOW, decks: 0 }]);
  });
});

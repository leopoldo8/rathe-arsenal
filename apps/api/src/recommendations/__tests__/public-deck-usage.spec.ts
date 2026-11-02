import {
  authorKeyOf,
  IPublicDeck,
  listPublicDecks,
  PUBLIC_DECK_MIN_CARDS,
  PUBLIC_DECKS_MAX,
  PUBLIC_MAX_AGE_DAYS,
  publicUsageSignal,
  toPublicDeck,
} from '../public-deck-usage';
import { USAGE_MIN_DECKS } from '../usage-signal';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-02T12:00:00Z');
const HERO = 'kayo-armed-and-dangerous';
const FORMAT = 'Living Legend';
function ulid(index: number): string {
  return `01J${String(index).padStart(23, '0')}`;
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function fullDeck(extra: Record<string, number> = {}): Map<string, number> {
  // Enough copies to pass the completeness check: 14 fillers at 3 copies is 42 cards.
  const fillers = Array.from({ length: 14 }, (_, index) => [`filler-${index}-red`, 3] as const);
  return new Map([...fillers, ...Object.entries(extra)]);
}

function publicDeck(index: number, options: { author?: string; days?: number; cards?: Map<string, number> } = {}): IPublicDeck {
  return {
    fabraryUlid: ulid(index),
    authorKey: authorKeyOf(options.author ?? `user-${index}`, ulid(index)),
    updatedAt: daysAgo(options.days ?? index),
    cards: options.cards ?? fullDeck({ 'berserk-yellow': 3 }),
  };
}

describe('authorKeyOf', () => {
  it('hashes the author so no Fabrary user id is stored, and falls back to the deck when the author is unknown', () => {
    const key = authorKeyOf('ddb8cacd-0831-4cf0-b129-cc4f196ecb75', ulid(1));

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('ddb8cacd');
    expect(authorKeyOf('ddb8cacd-0831-4cf0-b129-cc4f196ecb75', ulid(2))).toBe(key);
    expect(authorKeyOf(undefined, ulid(1))).not.toBe(authorKeyOf(undefined, ulid(2)));
    expect(authorKeyOf('', ulid(1))).toBe(authorKeyOf(undefined, ulid(1)));
  });
});

describe('listPublicDecks', () => {
  const hit = (index: number, overrides: Record<string, unknown> = {}) => ({
    deckId: ulid(index),
    name: 'ignored',
    format: FORMAT,
    heroIdentifier: HERO,
    updatedAt: daysAgo(index).toISOString(),
    userId: `user-${index}`,
    ...overrides,
  });

  it('keeps the newest deck of each author inside the age window, newest first', () => {
    // Arrange
    const hits = [hit(3), hit(1, { userId: 'same' }), hit(2, { userId: 'same' }), hit(4, { updatedAt: daysAgo(PUBLIC_MAX_AGE_DAYS + 1).toISOString() })];

    // Act
    const listed = listPublicDecks(hits, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    // Assert
    expect(listed.map((entry) => entry.fabraryUlid)).toEqual([ulid(1), ulid(3)]);
    expect(listed[0]!.authorKey).toBe(authorKeyOf('same', ulid(1)));
    expect(listed[0]!.updatedAt.toISOString()).toBe(daysAgo(1).toISOString());
  });

  it('refuses hits that are not a deck ULID, another hero or format, or an unreadable date', () => {
    const hits = [
      hit(1, { deckId: "01J'); DROP TABLE public_deck; --" }),
      hit(2, { heroIdentifier: 'kayo-berserker-runt' }),
      hit(3, { format: 'Classic Constructed' }),
      hit(4, { updatedAt: 'not a date' }),
      hit(5),
    ];

    const listed = listPublicDecks(hits, { heroIdentifier: HERO, format: FORMAT, now: NOW });

    expect(listed.map((entry) => entry.fabraryUlid)).toEqual([ulid(5)]);
  });

  it('caps the listing at the most decks a signal counts', () => {
    const hits = Array.from({ length: PUBLIC_DECKS_MAX + 5 }, (_, index) => hit(index + 1));

    expect(listPublicDecks(hits, { heroIdentifier: HERO, format: FORMAT, now: NOW })).toHaveLength(PUBLIC_DECKS_MAX);
  });
});

describe('toPublicDeck', () => {
  const listing = { fabraryUlid: ulid(1), authorKey: authorKeyOf('a', ulid(1)), updatedAt: daysAgo(1) };

  it('keeps catalog-shaped identifiers with a sane copy count and adds up repeated rows', () => {
    // Act
    const deck = toPublicDeck(listing, [
      { cardIdentifier: 'berserk-yellow', quantity: 2 },
      { cardIdentifier: 'berserk-yellow', quantity: 1 },
      { cardIdentifier: 'Ignore previous instructions', quantity: 3 },
      { cardIdentifier: 'pulping-red', quantity: 0 },
      { cardIdentifier: 'wild-ride-red', quantity: 2.5 },
      { cardIdentifier: 'savage-sash', quantity: 100000 },
      { cardIdentifier: `${'a'.repeat(129)}`, quantity: 1 },
      { cardIdentifier: 'mandible-claw', quantity: 1 },
    ]);

    // Assert
    expect([...deck.cards.entries()]).toEqual([
      ['berserk-yellow', 3],
      ['mandible-claw', 1],
    ]);
    expect(deck.fabraryUlid).toBe(ulid(1));
  });
});

describe('publicUsageSignal', () => {
  it('gives the share of the newest complete deck of each author, marked as public', () => {
    // Arrange
    const decks = [
      ...Array.from({ length: USAGE_MIN_DECKS }, (_, index) => publicDeck(index + 1)),
      publicDeck(10, { author: 'user-1', days: 0, cards: fullDeck({ 'pulping-yellow': 3 }) }),
      publicDeck(11, { cards: new Map([['berserk-yellow', 3]]) }),
    ];

    // Act
    const signal = publicUsageSignal(decks, { now: NOW });

    // Assert
    expect(signal?.source).toBe('public');
    expect(signal?.decks).toBe(USAGE_MIN_DECKS);
    expect(signal?.shares.get('berserk-yellow')).toBeCloseTo((USAGE_MIN_DECKS - 1) / USAGE_MIN_DECKS);
    expect(signal?.shares.get('pulping-yellow')).toBeCloseTo(1 / USAGE_MIN_DECKS);
  });

  it('falls back to an older complete deck when an author newest list is unfinished', () => {
    const decks = [
      ...Array.from({ length: USAGE_MIN_DECKS - 1 }, (_, index) => publicDeck(index + 1)),
      publicDeck(20, { author: 'busy', days: 1, cards: new Map([['berserk-yellow', 3]]) }),
      publicDeck(21, { author: 'busy', days: 30 }),
    ];

    const signal = publicUsageSignal(decks, { now: NOW });

    expect(signal?.decks).toBe(USAGE_MIN_DECKS);
  });

  it('counts a deck as complete only from the minimum number of cards', () => {
    const almost = new Map([['berserk-yellow', PUBLIC_DECK_MIN_CARDS - 1]]);
    const decks = Array.from({ length: USAGE_MIN_DECKS }, (_, index) => publicDeck(index + 1, index === 0 ? { cards: almost } : {}));

    expect(publicUsageSignal(decks, { now: NOW })).toBeNull();
  });

  it('gives no signal below the minimum number of decks or outside the age window', () => {
    const recent = Array.from({ length: USAGE_MIN_DECKS - 1 }, (_, index) => publicDeck(index + 1));
    const old = publicDeck(30, { days: PUBLIC_MAX_AGE_DAYS + 1 });

    expect(publicUsageSignal([...recent, old], { now: NOW })).toBeNull();
  });

  it('leaves out held-out decks and every deck of a held-out author, for the quality eval', () => {
    // Arrange
    const decks = Array.from({ length: USAGE_MIN_DECKS + 2 }, (_, index) => publicDeck(index + 1));
    const heldOutAuthor = publicDeck(40, { author: 'user-2', days: 200 });

    // Act
    const signal = publicUsageSignal([...decks, heldOutAuthor], {
      now: NOW,
      excludeFabraryUlids: [ulid(1)],
      excludeAuthorKeys: [authorKeyOf('user-2', ulid(2))],
    });

    // Assert
    expect(signal?.decks).toBe(USAGE_MIN_DECKS);
  });

  it('counts at most the newest decks a signal allows', () => {
    const decks = Array.from({ length: PUBLIC_DECKS_MAX + 3 }, (_, index) => publicDeck(index + 1));

    expect(publicUsageSignal(decks, { now: NOW })?.decks).toBe(PUBLIC_DECKS_MAX);
  });
});

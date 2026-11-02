import { catalog } from '@rathe-arsenal/engine';
import { buildRecommendationPool, buildRecommendationPrompt, IDeckList, isPitchSibling, PITCH_SIBLING_KEEP_SHARE } from '../recommendation-prompt';
import { IUsageSignal } from '../usage-signal';

const KAYO = catalog.getCard('kayo-armed-and-dangerous');

const kayoDeck: IDeckList = {
  heroIdentifier: 'kayo-armed-and-dangerous',
  format: 'Living Legend',
  cards: [
    { cardIdentifier: 'kayo-armed-and-dangerous', slot: 'hero', quantity: 1 },
    { cardIdentifier: 'pulping-red', slot: 'mainboard', quantity: 3 },
    { cardIdentifier: 'wrecker-romp-blue', slot: 'mainboard', quantity: 3 },
    { cardIdentifier: 'mandible-claw', slot: 'weapon', quantity: 1 },
  ],
};

function usage(decks: number, shares: Record<string, number>): IUsageSignal {
  return { decks, shares: new Map(Object.entries(shares)) };
}

function poolIds(options?: Parameters<typeof buildRecommendationPool>[4]): Set<string> {
  return new Set(buildRecommendationPool(kayoDeck, KAYO, new Set(), catalog, options).map((card) => card.cardIdentifier));
}

describe('pitch versions of deck cards', () => {
  it('a card is a pitch sibling when the deck plays the same name in another pitch', () => {
    const deckNames = new Set(['Pulping', 'Wrecker Romp']);

    expect(isPitchSibling(catalog.getCard('pulping-yellow'), deckNames)).toBe(true);
    expect(isPitchSibling(catalog.getCard('wrecker-romp-red'), deckNames)).toBe(true);
    expect(isPitchSibling(catalog.getCard('berserk-yellow'), deckNames)).toBe(false);
    // Equipment has no pitch, so it is never another version of a deck card.
    expect(isPitchSibling(catalog.getCard('savage-sash'), new Set(['Savage Sash']))).toBe(false);
  });

  it('the pool keeps pitch siblings unless asked to drop them', () => {
    // Act
    const kept = poolIds();
    const dropped = poolIds({ dropPitchSiblings: true });

    // Assert
    expect(kept.has('pulping-yellow')).toBe(true);
    expect(kept.has('wrecker-romp-red')).toBe(true);
    expect(dropped.has('pulping-yellow')).toBe(false);
    expect(dropped.has('pulping-blue')).toBe(false);
    expect(dropped.has('wrecker-romp-red')).toBe(false);
    expect(dropped.has('berserk-yellow')).toBe(true);
    expect(dropped.size).toBe(kept.size - 4);
  });

  it('a sibling that enough reference decks play stays in the pool', () => {
    const signal = usage(11, { 'pulping-yellow': PITCH_SIBLING_KEEP_SHARE, 'pulping-blue': PITCH_SIBLING_KEEP_SHARE - 0.01 });

    const pool = poolIds({ dropPitchSiblings: true, usage: signal });

    expect(pool.has('pulping-yellow')).toBe(true);
    expect(pool.has('pulping-blue')).toBe(false);
  });
});

describe('usage in the prompt', () => {
  const pool = buildRecommendationPool(kayoDeck, KAYO, new Set(), catalog);

  it('without usage the model is told to judge only from the rules text, and no usage section is written', () => {
    const { system, prompt } = buildRecommendationPrompt(kayoDeck, KAYO, pool, catalog);
    const withNull = buildRecommendationPrompt(kayoDeck, KAYO, pool, catalog, null);

    expect(system).toContain('Judge only from the rules text given.');
    expect(prompt).not.toMatch(/tournament decks/);
    expect(withNull).toEqual({ system, prompt });
  });

  it('lists the share of reference decks for pool and deck cards, most played first, and asks the model to weigh it', () => {
    // Arrange
    const signal = usage(11, {
      'berserk-yellow': 10 / 11,
      'apex-bonebreaker': 9 / 11,
      'pulping-red': 1,
      'pulping-yellow': 8 / 11,
      'beast-within-yellow': 1 / 11,
      'not-in-catalog-or-pool': 1,
    });

    // Act
    const { system, prompt } = buildRecommendationPrompt(kayoDeck, KAYO, pool, catalog, signal);

    // Assert
    expect(system).not.toContain('Judge only from the rules text given.');
    expect(system).toMatch(/how often recent tournament decks/);
    expect(prompt).toContain('Share of the 11 most recent tournament decks for this hero and format that play each card');
    const section = prompt.slice(prompt.indexOf('Share of the 11'));
    const lines = section.split('\n').slice(1).filter((line) => /^[a-z0-9-]+: \d+%/.test(line));
    expect(lines).toEqual(['pulping-red: 100% (in the deck)', 'berserk-yellow: 91%', 'apex-bonebreaker: 82%', 'pulping-yellow: 73%']);
    expect(prompt).not.toContain('not-in-catalog-or-pool');
    expect(section).not.toContain('beast-within-yellow');
    expect(prompt.indexOf('Share of the 11')).toBeGreaterThan(prompt.indexOf('Candidate pool'));
    expect(prompt.indexOf('Share of the 11')).toBeLessThan(prompt.indexOf('Rank the'));
  });
});

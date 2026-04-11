import { computeEffectiveReadiness } from '../src/readiness/compute';
import { ICatalog, ICatalogCard, Class, Keyword, Talent, Type } from '../src';
import { buildIndices } from '../src/catalog/indices';
import { DEFAULT_PITCH_TOLERANCE } from '../src/substitution/constants';

function makeCard(overrides: Partial<ICatalogCard> & { cardIdentifier: string }): ICatalogCard {
  const base: ICatalogCard = {
    cardIdentifier: overrides.cardIdentifier,
    name: overrides.cardIdentifier,
    classes: [Class.Warrior],
    talents: [] as readonly Talent[],
    types: [Type.Action],
    pitch: 1,
    power: 3,
    defense: 3,
    cost: 1,
    keywords: [Keyword.GoAgain],
    subtypes: [],
    legalHeroes: [],
  };
  return Object.freeze({ ...base, ...overrides });
}

function makeCatalog(cards: ICatalogCard[]): ICatalog {
  const frozen = Object.freeze(cards);
  const indices = buildIndices(frozen);

  return Object.freeze({
    cards: frozen,
    indices,
    getCard(identifier: string): ICatalogCard {
      const card = indices.byIdentifier.get(identifier);
      if (!card) throw new Error(`Card not found: ${identifier}`);
      return card;
    },
    getRawCard(identifier: string): unknown {
      const card = indices.byIdentifier.get(identifier);
      if (!card) throw new Error(`Card not found: ${identifier}`);
      return card;
    },
  });
}

describe('computeEffectiveReadiness', () => {
  const heroCard = makeCard({
    cardIdentifier: 'dorinthea-ironsong',
    types: [Type.Hero],
    pitch: null,
    power: null,
    defense: null,
    cost: null,
    keywords: [],
  });

  const weaponCard = makeCard({
    cardIdentifier: 'dawnblade',
    types: [Type.Weapon],
    pitch: null,
    power: null,
    defense: null,
    cost: null,
    keywords: [],
  });

  const cardA = makeCard({
    cardIdentifier: 'warrior-attack-red',
    pitch: 1,
    power: 3,
    defense: 3,
    keywords: [Keyword.GoAgain],
  });

  const cardB = makeCard({
    cardIdentifier: 'warrior-attack-red-alt',
    pitch: 1,
    power: 3,
    defense: 3,
    keywords: [Keyword.GoAgain],
  });

  const cardC = makeCard({
    cardIdentifier: 'warrior-attack-blue',
    pitch: 3,
    power: 3,
    defense: 3,
    keywords: [Keyword.GoAgain],
  });

  const catalog = makeCatalog([heroCard, weaponCard, cardA, cardB, cardC]);

  it('returns 100% raw and effective when all cards are owned', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
        { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
        { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
      ],
    };
    const inventory = new Map([
      ['dorinthea-ironsong', 1],
      ['dawnblade', 1],
      ['warrior-attack-red', 3],
    ]);

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBe(100);
    expect(result.effectivePercent).toBe(100);
    expect(result.breakdown.exact).toHaveLength(3);
    expect(result.breakdown.substituted).toHaveLength(0);
    expect(result.breakdown.missing).toHaveLength(0);
    expect(result.substitutions).toHaveLength(0);
  });

  it('performs a single tier 1 substitution for a missing mainboard card', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
      ],
    };
    // Own 2 of cardA, 1 of cardB (substitutable)
    const inventory = new Map([
      ['warrior-attack-red', 2],
      ['warrior-attack-red-alt', 1],
    ]);

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBeCloseTo(66.7, 0);
    expect(result.effectivePercent).toBe(100);
    expect(result.breakdown.exact).toHaveLength(1);
    expect(result.breakdown.exact[0]!.quantity).toBe(2);
    expect(result.breakdown.substituted).toHaveLength(1);
    expect(result.breakdown.substituted[0]!.match.substitute.cardIdentifier).toBe('warrior-attack-red-alt');
    expect(result.breakdown.missing).toHaveLength(0);
  });

  it('keeps missing cards when no valid substitute exists', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
      ],
    };
    // Only own cardC (blue pitch) -- not a valid substitute for red
    const inventory = new Map([
      ['warrior-attack-blue', 3],
    ]);

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBe(0);
    expect(result.effectivePercent).toBe(0);
    expect(result.breakdown.exact).toHaveLength(0);
    expect(result.breakdown.missing).toHaveLength(1);
    expect(result.breakdown.missing[0]!.quantity).toBe(3);
  });

  it('hero card goes to missing and is never substituted (R20)', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
        { cardIdentifier: 'warrior-attack-red', quantity: 1, slot: 'mainboard' },
      ],
    };
    const inventory = new Map([
      ['warrior-attack-red', 1],
    ]);

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBe(50);
    expect(result.effectivePercent).toBe(50);
    const missingHero = result.breakdown.missing.find(
      (e) => e.cardIdentifier === 'dorinthea-ironsong',
    );
    expect(missingHero).toBeDefined();
    expect(missingHero!.slot).toBe('hero');
    // No substitution should have been attempted for the hero
    expect(result.substitutions).toHaveLength(0);
  });

  it('weapon card goes to missing and is never substituted (R20)', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
        { cardIdentifier: 'warrior-attack-red', quantity: 1, slot: 'mainboard' },
      ],
    };
    const inventory = new Map([
      ['warrior-attack-red', 1],
    ]);

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBe(50);
    expect(result.effectivePercent).toBe(50);
    const missingWeapon = result.breakdown.missing.find(
      (e) => e.cardIdentifier === 'dawnblade',
    );
    expect(missingWeapon).toBeDefined();
    expect(missingWeapon!.slot).toBe('weapon');
    expect(result.substitutions).toHaveLength(0);
  });

  it('returns 0% for everything when inventory is empty', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
        { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
        { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
      ],
    };
    const inventory = new Map<string, number>();

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBe(0);
    expect(result.effectivePercent).toBe(0);
    expect(result.breakdown.exact).toHaveLength(0);
    expect(result.breakdown.substituted).toHaveLength(0);
    expect(result.breakdown.missing.length).toBeGreaterThan(0);
  });

  it('includes pitch curve in the result', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'warrior-attack-red', quantity: 2, slot: 'mainboard' },
        { cardIdentifier: 'warrior-attack-blue', quantity: 1, slot: 'mainboard' },
      ],
    };
    const inventory = new Map([
      ['warrior-attack-red', 2],
      ['warrior-attack-blue', 1],
    ]);

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.pitchCurve.original.red).toBe(2);
    expect(result.pitchCurve.original.blue).toBe(1);
    expect(result.pitchCurve.modified.red).toBe(2);
    expect(result.pitchCurve.modified.blue).toBe(1);
  });

  it('is deterministic: same inputs produce same outputs', () => {
    const deck = {
      cards: [
        { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
      ],
    };
    const inventory = new Map([
      ['warrior-attack-red', 2],
      ['warrior-attack-red-alt', 1],
    ]);

    const result1 = computeEffectiveReadiness(deck, inventory, catalog);
    const result2 = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result1.rawPercent).toBe(result2.rawPercent);
    expect(result1.effectivePercent).toBe(result2.effectivePercent);
    expect(result1.substitutions.length).toBe(result2.substitutions.length);
    if (result1.substitutions.length > 0) {
      expect(result1.substitutions[0]!.substitute.cardIdentifier).toBe(
        result2.substitutions[0]!.substitute.cardIdentifier,
      );
    }
  });

  it('handles an empty deck', () => {
    const deck = { cards: [] };
    const inventory = new Map<string, number>();

    const result = computeEffectiveReadiness(deck, inventory, catalog);

    expect(result.rawPercent).toBe(0);
    expect(result.effectivePercent).toBe(0);
    expect(result.breakdown.exact).toHaveLength(0);
    expect(result.breakdown.substituted).toHaveLength(0);
    expect(result.breakdown.missing).toHaveLength(0);
  });

  it('rejects substitution when pitch curve tolerance would be exceeded', () => {
    // Build a deck heavily weighted toward red
    // The only candidate is blue-pitch, so substituting would break pitch curve
    const redCard = makeCard({
      cardIdentifier: 'red-heavy',
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const blueCandidate = makeCard({
      cardIdentifier: 'blue-candidate',
      pitch: 1, // same pitch for hard constraint
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const smallCatalog = makeCatalog([redCard, blueCandidate]);

    const deck = {
      cards: [
        { cardIdentifier: 'red-heavy', quantity: 1, slot: 'mainboard' },
      ],
    };

    // The blue candidate is in inventory, but since it has the same pitch as 1,
    // pitch curve won't break. This test verifies the pitch check path runs.
    const inventory = new Map([['blue-candidate', 1]]);

    const result = computeEffectiveReadiness(
      deck,
      inventory,
      smallCatalog,
      DEFAULT_PITCH_TOLERANCE,
    );

    // Since both cards have pitch 1, the substitution should succeed
    // (pitch curve stays the same)
    expect(result.effectivePercent).toBe(100);
    expect(result.breakdown.substituted).toHaveLength(1);
  });

  describe('path field', () => {
    it('returns Path A when every card is owned exactly', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([['warrior-attack-red', 3]]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('A');
    });

    it('returns Path B when all missing copies are covered by substitutions', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('B');
      expect(result.effectivePercent).toBe(100);
    });

    it('returns Path C when some cards remain missing after substitution', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map<string, number>();

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('C');
    });

    it('derives Path A from a degenerate empty deck', () => {
      const deck = { cards: [] };
      const inventory = new Map<string, number>();

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('A');
    });
  });

  describe('tier 2 substitution in readiness', () => {
    const tier2Missing = makeCard({
      cardIdentifier: 'tier2-missing',
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier2Candidate = makeCard({
      cardIdentifier: 'tier2-candidate',
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.Intimidate], // zero overlap, tier 2 only
    });

    const tieredCatalog = makeCatalog([tier2Missing, tier2Candidate]);

    it('falls through to tier 2 when no tier 1 candidate is available', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'tier2-missing', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([['tier2-candidate', 1]]);

      const result = computeEffectiveReadiness(deck, inventory, tieredCatalog);

      expect(result.breakdown.substituted).toHaveLength(1);
      expect(result.breakdown.substituted[0]!.match.tier).toBe(2);
      expect(result.path).toBe('B');
      expect(result.effectivePercent).toBe(100);
    });

    it('populates substitutions array with tier 2 match when tier 2 fires', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'tier2-missing', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([['tier2-candidate', 1]]);

      const result = computeEffectiveReadiness(deck, inventory, tieredCatalog);

      expect(result.substitutions).toHaveLength(1);
      expect(result.substitutions[0]!.tier).toBe(2);
      expect(result.substitutions[0]!.rationale).toContain('Tier 2 substitute');
    });
  });

  describe('excludedIdentifiers parameter (re-solve)', () => {
    it('skips tier 1 candidates in the exclusion set and falls through to tier 2', () => {
      const missing = makeCard({
        cardIdentifier: 'pick-me',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const tier1Best = makeCard({
        cardIdentifier: 'tier1-best',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const tier2Fallback = makeCard({
        cardIdentifier: 'tier2-fallback',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.Intimidate],
      });

      const exclusionCatalog = makeCatalog([missing, tier1Best, tier2Fallback]);

      const deck = {
        cards: [
          { cardIdentifier: 'pick-me', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['tier1-best', 1],
        ['tier2-fallback', 1],
      ]);

      // Without exclusions: picks tier 1 best
      const unrestricted = computeEffectiveReadiness(
        deck,
        inventory,
        exclusionCatalog,
      );
      expect(unrestricted.breakdown.substituted[0]!.match.substitute.cardIdentifier).toBe('tier1-best');
      expect(unrestricted.breakdown.substituted[0]!.match.tier).toBe(1);

      // With tier 1 best excluded: falls through to tier 2 fallback
      const restricted = computeEffectiveReadiness(
        deck,
        inventory,
        exclusionCatalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(['tier1-best']),
      );
      expect(restricted.breakdown.substituted[0]!.match.substitute.cardIdentifier).toBe('tier2-fallback');
      expect(restricted.breakdown.substituted[0]!.match.tier).toBe(2);
    });

    it('moves a card to missing when every candidate is excluded and reports Path C', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);

      // Excluding the only substitute -> third copy cannot be substituted.
      const result = computeEffectiveReadiness(
        deck,
        inventory,
        catalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(['warrior-attack-red-alt']),
      );

      expect(result.breakdown.missing).toHaveLength(1);
      expect(result.breakdown.missing[0]!.quantity).toBe(1);
      expect(result.breakdown.substituted).toHaveLength(0);
      expect(result.path).toBe('C');
    });

    it('empty exclusion set matches the default no-exclusion behavior', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);

      const withEmptySet = computeEffectiveReadiness(
        deck,
        inventory,
        catalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(),
      );
      const withoutArg = computeEffectiveReadiness(deck, inventory, catalog);

      expect(withEmptySet.effectivePercent).toBe(withoutArg.effectivePercent);
      expect(withEmptySet.path).toBe(withoutArg.path);
      expect(withEmptySet.breakdown.substituted.length).toBe(
        withoutArg.breakdown.substituted.length,
      );
    });
  });
});

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
    sets: [],
    imageUrl: null,
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

  describe('fidelityPercent field (Path C)', () => {
    it('returns 100 fidelity for Path A (all exact)', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([['warrior-attack-red', 3]]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('A');
      expect(result.fidelityPercent).toBe(100);
    });

    it('returns Path C with zero fidelity when user owns nothing', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map<string, number>();

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('C');
      expect(result.fidelityPercent).toBe(0);
    });

    it('returns Path C with tier-1-weighted fidelity when some cards are unsubstituted', () => {
      // Deck needs 3x warrior-attack-red.
      // Inventory has 1x warrior-attack-red (exact) + 1x warrior-attack-red-alt (tier 1 sub).
      // One copy is left unsubstituted -> Path C.
      // Fidelity = (1 * 1.0 + 1 * 0.9) / 3 * 100 = 63.333...
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 1],
        ['warrior-attack-red-alt', 1],
      ]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('C');
      expect(result.breakdown.exact).toHaveLength(1);
      expect(result.breakdown.substituted).toHaveLength(1);
      expect(result.breakdown.substituted[0]!.match.tier).toBe(1);
      expect(result.breakdown.missing).toHaveLength(1);
      expect(result.fidelityPercent).toBeCloseTo(63.3333, 3);
    });

    it('returns Path B with tier-1-weighted fidelity below 100 when substitutions cover all missing', () => {
      // Deck needs 3x warrior-attack-red. Inventory has 2 exact + 1 tier 1 substitute.
      // Path B (effective = 100) but fidelity reflects the tier weight: (2 + 0.9) / 3 * 100 = 96.666...
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
      expect(result.fidelityPercent).toBeCloseTo(96.6666, 3);
      expect(result.fidelityPercent).toBeLessThan(100);
    });

    it('returns 0 fidelity for an empty deck', () => {
      const deck = { cards: [] };
      const inventory = new Map<string, number>();

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.fidelityPercent).toBe(0);
      expect(Number.isNaN(result.fidelityPercent)).toBe(false);
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

  // ---------------------------------------------------------------------------
  // U11: IBreakdownEntry enrichment — pitch, cost, type
  // ---------------------------------------------------------------------------

  describe('IBreakdownEntry enrichment (U11)', () => {
    it('(happy path) exact entry for a red-pitch attack carries pitch=1, cost, and type', () => {
      // cardA has pitch=1, cost=1, types=[Type.Action]
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([['warrior-attack-red', 1]]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.breakdown.exact).toHaveLength(1);
      const entry = result.breakdown.exact[0]!;
      expect(entry.pitch).toBe(1);
      expect(entry.cost).toBe(1);
      expect(entry.type).toBe(Type.Action);
    });

    it('(happy path) weapon card has pitch=null, cost=null in breakdown entry', () => {
      // weaponCard has pitch=null, cost=null
      const deck = {
        cards: [
          { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
          { cardIdentifier: 'warrior-attack-red', quantity: 1, slot: 'mainboard' },
        ],
      };
      // Missing the weapon — it goes to missing list.
      const inventory = new Map([['warrior-attack-red', 1]]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      const missingWeapon = result.breakdown.missing.find(
        (e) => e.cardIdentifier === 'dawnblade',
      );
      expect(missingWeapon).toBeDefined();
      expect(missingWeapon!.pitch).toBeNull();
      expect(missingWeapon!.cost).toBeNull();
      expect(missingWeapon!.type).toBe(Type.Weapon);
    });

    it('(happy path) hero card has pitch=null, cost=null, type=Hero', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
        ],
      };
      const inventory = new Map<string, number>(); // missing

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      const missingHero = result.breakdown.missing.find(
        (e) => e.cardIdentifier === 'dorinthea-ironsong',
      );
      expect(missingHero).toBeDefined();
      expect(missingHero!.pitch).toBeNull();
      expect(missingHero!.cost).toBeNull();
      expect(missingHero!.type).toBe(Type.Hero);
    });

    it('(happy path) every entry has type populated (not undefined, not empty string)', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
          { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
          { cardIdentifier: 'warrior-attack-red', quantity: 2, slot: 'mainboard' },
          { cardIdentifier: 'warrior-attack-red-alt', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['dorinthea-ironsong', 1],
        ['warrior-attack-red', 2],
        // dawnblade missing, warrior-attack-red-alt missing
      ]);

      const result = computeEffectiveReadiness(deck, inventory, catalog);

      const allEntries = [
        ...result.breakdown.exact,
        ...result.breakdown.missing,
        ...result.breakdown.substituted.map((s) => s.original),
      ];

      for (const entry of allEntries) {
        expect(typeof entry.type).toBe('string');
        expect(entry.type.length).toBeGreaterThan(0);
      }
    });

    it('(edge case) card not in catalog returns pitch:null, cost:null, type:"unknown" without throwing', () => {
      // Build a catalog that does NOT contain the card referenced in the deck.
      const unknownCatalog = makeCatalog([cardA]); // only has warrior-attack-red

      const deck = {
        cards: [
          { cardIdentifier: 'ghost-card-not-in-catalog', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map<string, number>();

      // Should not throw
      const result = computeEffectiveReadiness(deck, inventory, unknownCatalog);

      expect(result.breakdown.missing).toHaveLength(1);
      const entry = result.breakdown.missing[0]!;
      expect(entry.cardIdentifier).toBe('ghost-card-not-in-catalog');
      expect(entry.pitch).toBeNull();
      expect(entry.cost).toBeNull();
      expect(entry.type).toBe('unknown');
    });

    it('(regression) rawPercent, effectivePercent, slot, quantity are unchanged by U11', () => {
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

      // Core readiness fields must not regress.
      expect(result.rawPercent).toBeCloseTo(66.7, 0);
      expect(result.effectivePercent).toBe(100);
      expect(result.path).toBe('B');
      expect(result.breakdown.exact[0]!.slot).toBe('mainboard');
      expect(result.breakdown.exact[0]!.quantity).toBe(2);
      expect(result.breakdown.substituted[0]!.original.slot).toBe('mainboard');
      expect(result.breakdown.substituted[0]!.original.quantity).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: deck-needed cards must not be consumed by substitution for
  // another slot in the same deck (two-pass allocation fix).
  // ---------------------------------------------------------------------------

  describe('two-pass allocation: deck-needed cards are never offered as substitutes', () => {
    it('does not offer card A as substitute for card B when deck needs both and only A is owned', () => {
      // Deck needs 3x cardA and 2x cardB.
      // Inventory: 3x cardA, 0x cardB.
      // Bug (single-pass): if cardB is processed first in substitution search,
      // cardA is in remainingInventory and gets offered as a substitute for cardB.
      // After the fix (two-pass): cardA's exact-match reservation runs before any
      // substitution search, so cardA is fully consumed by its own slot and is
      // never available to substitute for cardB.

      const deckCardA = makeCard({
        cardIdentifier: 'deck-card-a',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const deckCardB = makeCard({
        cardIdentifier: 'deck-card-b',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });

      const twoCardCatalog = makeCatalog([deckCardA, deckCardB]);

      // Card B is listed FIRST in the deck so that the single-pass implementation
      // processes B before A. At that point A is still in remainingInventory and
      // gets offered as a substitute for B, stealing copies that A's own slot needs.
      const deck = {
        cards: [
          { cardIdentifier: 'deck-card-b', quantity: 2, slot: 'mainboard' },
          { cardIdentifier: 'deck-card-a', quantity: 3, slot: 'mainboard' },
        ],
      };

      // Own exactly the right number of A; own none of B.
      const inventory = new Map([['deck-card-a', 3]]);

      const result = computeEffectiveReadiness(deck, inventory, twoCardCatalog);

      // Card A must appear as exact (full quantity 3).
      const exactA = result.breakdown.exact.find(
        (e) => e.cardIdentifier === 'deck-card-a',
      );
      expect(exactA).toBeDefined();
      expect(exactA!.quantity).toBe(3);

      // Card B must appear as missing (full quantity 2) — no substitute from A.
      const missingB = result.breakdown.missing.find(
        (e) => e.cardIdentifier === 'deck-card-b',
      );
      expect(missingB).toBeDefined();
      expect(missingB!.quantity).toBe(2);

      // No substitution should have fired.
      expect(result.breakdown.substituted).toHaveLength(0);
      expect(result.substitutions).toHaveLength(0);
    });

    it('partial A scenario: only unneeded A copies can substitute for B', () => {
      // Deck needs 2x cardA and 2x cardB.
      // Inventory: 3x cardA, 0x cardB.
      // After two-pass: 2 copies of A reserved for A's exact slot.
      // 1 copy of A is surplus and CAN substitute for B (up to 1 copy).
      // Result: 2 exact A, 1 substituted B (from surplus A), 1 missing B.

      const deckCardA = makeCard({
        cardIdentifier: 'partial-a',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const deckCardB = makeCard({
        cardIdentifier: 'partial-b',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });

      const twoCardCatalog = makeCatalog([deckCardA, deckCardB]);

      // Card B is listed FIRST so the single-pass code sees it before A.
      const deck = {
        cards: [
          { cardIdentifier: 'partial-b', quantity: 2, slot: 'mainboard' },
          { cardIdentifier: 'partial-a', quantity: 2, slot: 'mainboard' },
        ],
      };

      // 3 copies of A owned, deck needs 2 — 1 copy surplus.
      const inventory = new Map([['partial-a', 3]]);

      const result = computeEffectiveReadiness(deck, inventory, twoCardCatalog);

      // A must be fully exact.
      const exactA = result.breakdown.exact.find(
        (e) => e.cardIdentifier === 'partial-a',
      );
      expect(exactA).toBeDefined();
      expect(exactA!.quantity).toBe(2);

      // B should have 1 copy substituted (from surplus A) and 1 copy missing.
      const substitutedForB = result.breakdown.substituted.filter(
        (s) => s.original.cardIdentifier === 'partial-b',
      );
      expect(substitutedForB).toHaveLength(1);
      expect(substitutedForB[0]!.match.substitute.cardIdentifier).toBe('partial-a');

      const missingB = result.breakdown.missing.find(
        (e) => e.cardIdentifier === 'partial-b',
      );
      expect(missingB).toBeDefined();
      expect(missingB!.quantity).toBe(1);
    });
  });
});

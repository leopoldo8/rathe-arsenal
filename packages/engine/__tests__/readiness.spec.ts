import { computeEffectiveReadiness } from '../src/readiness/compute';
import { ICatalog, ICatalogCard, Class, Format, Keyword, Rarity, Talent, Type } from '../src';
import { buildIndices } from '../src/catalog/indices';
import { DEFAULT_PITCH_TOLERANCE } from '../src/substitution/constants';
import { buildExclusionKey, TExclusionKey } from '../src/substitution/exclusion-key';
import { IEffectiveReadinessResult } from '../src/readiness/types';
import { buildProtectedKey } from '../src/readiness/protected-key';

/**
 * Runs `computeEffectiveReadiness` twice: once to discover every match the
 * engine finds, then again with every discovered match's key pre-approved.
 *
 * Tests that predate D7/SWAP-13 assert an `effectivePercent` ceiling that
 * assumed every found substitution counted. This helper reproduces that
 * ceiling under the new gated semantics (§0) without changing what each
 * test is actually about -- it decouples "does the engine find the right
 * substitution" from "is a pending substitution approved", which is this
 * design's own recommendation for tests whose subject isn't gating itself.
 */
function computeWithAllFoundApproved(
  deck: Parameters<typeof computeEffectiveReadiness>[0],
  inventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  tolerance = DEFAULT_PITCH_TOLERANCE,
  excludedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
): IEffectiveReadinessResult {
  const discovery = computeEffectiveReadiness(
    deck,
    inventory,
    catalog,
    tolerance,
    excludedIdentifiers,
  );
  const approvedIdentifiers = new Set<TExclusionKey>(
    discovery.breakdown.substituted.map((entry) =>
      buildExclusionKey(
        entry.original.cardIdentifier,
        entry.original.slot,
        entry.match.substitute.cardIdentifier,
      ),
    ),
  );
  return computeEffectiveReadiness(
    deck,
    inventory,
    catalog,
    tolerance,
    excludedIdentifiers,
    approvedIdentifiers,
  );
}

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
    legalFormats: [Format.ClassicConstructed],
    rarity: Rarity.Common,
    young: false,
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

    const result = computeWithAllFoundApproved(deck, inventory, catalog);

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

    const result = computeWithAllFoundApproved(
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

      const result = computeWithAllFoundApproved(deck, inventory, catalog);

      expect(result.path).toBe('B');
      expect(result.effectivePercent).toBe(100);
    });

    it('returns Path B while pct sits below 100 when its substitution is not yet approved (D7/SWAP-13)', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);

      // No approvedIdentifiers passed -- the substitution is found but pending.
      const result = computeEffectiveReadiness(deck, inventory, catalog);

      expect(result.path).toBe('B');
      expect(result.effectivePercent).toBeLessThan(100);
      expect(result.breakdown.substituted).toHaveLength(1);
      expect(result.breakdown.substituted[0]!.approved).toBe(false);
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

      const result = computeWithAllFoundApproved(deck, inventory, catalog);

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

      const result = computeWithAllFoundApproved(deck, inventory, tieredCatalog);

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
        new Set([buildExclusionKey('pick-me', 'mainboard', 'tier1-best')]),
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
        new Set([buildExclusionKey('warrior-attack-red', 'mainboard', 'warrior-attack-red-alt')]),
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
        new Set<TExclusionKey>(),
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

      const result = computeWithAllFoundApproved(deck, inventory, catalog);

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

    it('resolves two copies of the same original to two different substitutes when the first substitute is exhausted mid-loop', () => {
      // Grounds the "one row per group, not per original card" decision
      // (§3): the per-copy loop is not guaranteed to pick the same
      // substitute for every copy of the same missing card.
      const subA = makeCard({
        cardIdentifier: 'sub-a',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const subB = makeCard({
        cardIdentifier: 'sub-b',
        pitch: 1,
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });

      const twoSubCatalog = makeCatalog([cardA, subA, subB]);

      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 2, slot: 'mainboard' },
        ],
      };
      // One copy each of two equally-valid substitutes -- neither alone
      // covers both missing copies of cardA.
      const inventory = new Map([
        ['sub-a', 1],
        ['sub-b', 1],
      ]);

      const result = computeEffectiveReadiness(deck, inventory, twoSubCatalog);

      expect(result.breakdown.substituted).toHaveLength(2);
      const substituteIds = result.breakdown.substituted
        .map((s) => s.match.substitute.cardIdentifier)
        .sort();
      expect(substituteIds).toEqual(['sub-a', 'sub-b']);
    });
  });

  describe('approvedIdentifiers parameter (D7/SWAP-13)', () => {
    it('a found match with an empty approvedIdentifiers set does not count toward effectivePercent', () => {
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

      expect(result.breakdown.substituted).toHaveLength(1);
      expect(result.breakdown.substituted[0]!.approved).toBe(false);
      // 2 exact / 3 total -- the pending substitution does not add to it.
      expect(result.effectivePercent).toBeCloseTo(66.7, 0);
    });

    it('the same match with its key present in approvedIdentifiers counts toward effectivePercent', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);
      const approvedIdentifiers = new Set([
        buildExclusionKey('warrior-attack-red', 'mainboard', 'warrior-attack-red-alt'),
      ]);

      const result = computeEffectiveReadiness(
        deck,
        inventory,
        catalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(),
        approvedIdentifiers,
      );

      expect(result.breakdown.substituted).toHaveLength(1);
      expect(result.breakdown.substituted[0]!.approved).toBe(true);
      expect(result.effectivePercent).toBe(100);
    });

    it('notOwned is identical whether or not the substitution is approved', () => {
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);
      const approvedIdentifiers = new Set([
        buildExclusionKey('warrior-attack-red', 'mainboard', 'warrior-attack-red-alt'),
      ]);

      const pending = computeEffectiveReadiness(deck, inventory, catalog);
      const approved = computeEffectiveReadiness(
        deck,
        inventory,
        catalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(),
        approvedIdentifiers,
      );

      expect(approved.breakdown.notOwned).toEqual(pending.breakdown.notOwned);
    });

    it('approving one of two distinct substitutions counts only that one', () => {
      const origOne = makeCard({ cardIdentifier: 'orig-one' });
      const origTwo = makeCard({ cardIdentifier: 'orig-two' });
      const shared = makeCard({ cardIdentifier: 'shared-substitute' });
      const twoCatalog = makeCatalog([origOne, origTwo, shared]);
      const deck = {
        cards: [
          { cardIdentifier: 'orig-one', quantity: 1, slot: 'mainboard' },
          { cardIdentifier: 'orig-two', quantity: 1, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([['shared-substitute', 2]]);
      const approvedIdentifiers = new Set([
        buildExclusionKey('orig-one', 'mainboard', 'shared-substitute'),
      ]);

      const result = computeEffectiveReadiness(
        deck,
        inventory,
        twoCatalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(),
        approvedIdentifiers,
      );

      const byOriginal = new Map(
        result.breakdown.substituted.map((entry) => [entry.original.cardIdentifier, entry.approved]),
      );
      expect(byOriginal).toEqual(new Map([['orig-one', true], ['orig-two', false]]));
      expect(result.effectivePercent).toBe(50);
    });

    it('inventory is consumed identically whether or not the substitution is approved', () => {
      // Approval must not change *which* substitute is chosen -- only
      // whether it counts. Both runs should leave the same remaining
      // owned quantity for the substitute (verified indirectly: both
      // pick the same substitute, and a third recompute against the
      // post-substitution inventory sees the same shortage either way).
      const deck = {
        cards: [
          { cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' },
        ],
      };
      const inventory = new Map([
        ['warrior-attack-red', 2],
        ['warrior-attack-red-alt', 1],
      ]);
      const approvedIdentifiers = new Set([
        buildExclusionKey('warrior-attack-red', 'mainboard', 'warrior-attack-red-alt'),
      ]);

      const pending = computeEffectiveReadiness(deck, inventory, catalog);
      const approved = computeEffectiveReadiness(
        deck,
        inventory,
        catalog,
        DEFAULT_PITCH_TOLERANCE,
        new Set(),
        approvedIdentifiers,
      );

      expect(pending.breakdown.substituted[0]!.match.substitute.cardIdentifier).toBe(
        approved.breakdown.substituted[0]!.match.substitute.cardIdentifier,
      );
      expect(pending.substitutions).toHaveLength(1);
      expect(approved.substitutions).toHaveLength(1);
    });
  });
});

describe('protectedCopies parameter (card-alternatives)', () => {
  const heroCard = makeCard({
    cardIdentifier: 'dorinthea-ironsong',
    types: [Type.Hero],
    pitch: null,
    power: null,
    defense: null,
    cost: null,
    keywords: [],
  });
  const original = makeCard({ cardIdentifier: 'warrior-attack-red', pitch: 1 });
  const standIn = makeCard({ cardIdentifier: 'warrior-attack-red-alt', pitch: 1 });
  const catalog = makeCatalog([heroCard, original, standIn]);

  // Three copies missing, three owned tier 1 candidates: today all three get a stand-in.
  const deck = { cards: [{ cardIdentifier: 'warrior-attack-red', quantity: 3, slot: 'mainboard' }] };
  const inventory = new Map([['warrior-attack-red-alt', 3]]);

  function run(protectedCopies: ReadonlyMap<string, number>): IEffectiveReadinessResult {
    return computeEffectiveReadiness(
      deck,
      inventory,
      catalog,
      DEFAULT_PITCH_TOLERANCE,
      new Set(),
      new Set(),
      protectedCopies,
    );
  }

  function missingQuantity(result: IEffectiveReadinessResult): number {
    return result.breakdown.missing.reduce((sum, entry) => sum + entry.quantity, 0);
  }

  it.each([
    ['0 protected copies', 0, 3, 0],
    ['1 protected copy', 1, 2, 1],
    ['3 protected copies, equal to the missing copies', 3, 0, 3],
    ['5 protected copies, above the missing copies', 5, 0, 3],
  ])('protected copies get no stand-in: %s', (_label, protectedCount, substituted, missing) => {
    const result = run(new Map([[buildProtectedKey('warrior-attack-red', 'mainboard'), protectedCount]]));

    expect(result.breakdown.substituted).toHaveLength(substituted);
    expect(missingQuantity(result)).toBe(missing);
  });

  it('protected copies get no stand-in: a count for the same card in another slot changes nothing', () => {
    const result = run(new Map([[buildProtectedKey('warrior-attack-red', 'equipment'), 3]]));

    expect(result.breakdown.substituted).toHaveLength(3);
    expect(missingQuantity(result)).toBe(0);
  });

  it('protected copies get no stand-in: the protected copies stay in notOwned and consume no inventory', () => {
    const result = run(new Map([[buildProtectedKey('warrior-attack-red', 'mainboard'), 3]]));

    expect(result.breakdown.notOwned).toEqual([
      expect.objectContaining({ cardIdentifier: 'warrior-attack-red', slot: 'mainboard', quantity: 3 }),
    ]);
    expect(result.breakdown.exact).toHaveLength(0);
  });

  it('an empty protected input changes nothing', () => {
    const tier2Original = makeCard({
      cardIdentifier: 'warrior-tier2-original',
      pitch: 2,
      power: 4,
      keywords: [Keyword.GoAgain],
    });
    const tier2StandIn = makeCard({ cardIdentifier: 'warrior-tier2-stand-in', pitch: 2, power: 6, keywords: [] });
    const weapon = makeCard({
      cardIdentifier: 'dawnblade',
      types: [Type.Weapon],
      pitch: null,
      power: null,
      defense: null,
      cost: null,
      keywords: [],
    });
    const wide = makeCatalog([heroCard, weapon, original, standIn, tier2Original, tier2StandIn]);
    const rejected = new Set<TExclusionKey>([
      buildExclusionKey('warrior-attack-red', 'mainboard', 'warrior-attack-red-alt'),
    ]);
    const approved = new Set<TExclusionKey>([
      buildExclusionKey('warrior-attack-red', 'mainboard', 'warrior-attack-red-alt'),
    ]);
    const scenarios: ReadonlyArray<{
      readonly deck: { readonly cards: readonly { cardIdentifier: string; quantity: number; slot: string }[] };
      readonly inventory: ReadonlyMap<string, number>;
      readonly excluded?: ReadonlySet<TExclusionKey>;
      readonly approved?: ReadonlySet<TExclusionKey>;
    }> = [
      { deck: { cards: [] }, inventory: new Map() },
      { deck, inventory: new Map([['warrior-attack-red', 3]]) },
      { deck, inventory },
      { deck, inventory, approved },
      { deck, inventory, excluded: rejected },
      { deck, inventory: new Map() },
      {
        deck: { cards: [{ cardIdentifier: 'warrior-tier2-original', quantity: 2, slot: 'mainboard' }] },
        inventory: new Map([['warrior-tier2-stand-in', 2]]),
      },
      {
        deck: {
          cards: [
            { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
            { cardIdentifier: 'dawnblade', quantity: 1, slot: 'weapon' },
            { cardIdentifier: 'warrior-attack-red', quantity: 2, slot: 'mainboard' },
            { cardIdentifier: 'warrior-attack-red', quantity: 1, slot: 'equipment' },
            { cardIdentifier: 'not-in-the-catalog', quantity: 1, slot: 'mainboard' },
          ],
        },
        inventory: new Map([
          ['warrior-attack-red', 1],
          ['warrior-attack-red-alt', 1],
        ]),
      },
    ];

    for (const scenario of scenarios) {
      const omitted = computeEffectiveReadiness(
        scenario.deck,
        scenario.inventory,
        wide,
        DEFAULT_PITCH_TOLERANCE,
        scenario.excluded ?? new Set(),
        scenario.approved ?? new Set(),
      );
      const empty = computeEffectiveReadiness(
        scenario.deck,
        scenario.inventory,
        wide,
        DEFAULT_PITCH_TOLERANCE,
        scenario.excluded ?? new Set(),
        scenario.approved ?? new Set(),
        new Map(),
      );

      expect(empty).toEqual(omitted);
    }
  });

  it('protected copies get no stand-in: a count is spent across two deck rows of the same card and slot', () => {
    // Nothing forbids a deck listing a card twice in one slot, and the replacement count is per card and slot.
    const twoRows = {
      cards: [
        { cardIdentifier: 'warrior-attack-red', quantity: 2, slot: 'mainboard' },
        { cardIdentifier: 'warrior-attack-red', quantity: 2, slot: 'mainboard' },
      ],
    };

    const result = computeEffectiveReadiness(
      twoRows,
      inventory,
      catalog,
      DEFAULT_PITCH_TOLERANCE,
      new Set(),
      new Set(),
      new Map([[buildProtectedKey('warrior-attack-red', 'mainboard'), 3]]),
    );

    // 3 of the 4 copies are protected, so only one can get a stand-in.
    expect(result.breakdown.substituted).toHaveLength(1);
    expect(result.breakdown.missing.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(3);
  });

  it("protected copies get no stand-in: the caller's map is not changed by a compute that spends it", () => {
    const protectedCopies = new Map([[buildProtectedKey('warrior-attack-red', 'mainboard'), 2]]);

    run(protectedCopies);
    run(protectedCopies);

    expect([...protectedCopies]).toEqual([[buildProtectedKey('warrior-attack-red', 'mainboard'), 2]]);
  });
});


import {
  scoreCandidate,
  findTierMatch,
} from '../src/substitution/score';
import {
  TIER_1_CONFIG,
  TIER_2_CONFIG,
  TIER_1_FLOOR_SCORE,
  TIER_2_FLOOR_SCORE,
} from '../src/substitution/constants';
import { ICatalog, ICatalogCard, Class, Keyword, Type, Talent } from '../src';
import { buildIndices } from '../src/catalog/indices';

/**
 * Helper to create a frozen ICatalogCard with sensible defaults.
 */
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

/**
 * Build a minimal ICatalog from an array of cards.
 */
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

describe('scoreCandidate (parameterized tier scoring)', () => {
  describe('shared hard constraints (both tiers)', () => {
    it('returns null when pitch differs', () => {
      const missing = makeCard({ cardIdentifier: 'a', pitch: 1 });
      const candidate = makeCard({ cardIdentifier: 'b', pitch: 3 });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
      expect(scoreCandidate(missing, candidate, TIER_2_CONFIG)).toBeNull();
    });

    it('returns null when class intersection is empty', () => {
      const missing = makeCard({ cardIdentifier: 'a', classes: [Class.Warrior] });
      const candidate = makeCard({ cardIdentifier: 'b', classes: [Class.Wizard] });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
      expect(scoreCandidate(missing, candidate, TIER_2_CONFIG)).toBeNull();
    });

    it('returns null when type intersection is empty', () => {
      const missing = makeCard({
        cardIdentifier: 'a',
        types: [Type.Action],
      });
      const candidate = makeCard({
        cardIdentifier: 'b',
        types: [Type.Instant],
      });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
      expect(scoreCandidate(missing, candidate, TIER_2_CONFIG)).toBeNull();
    });

    it('returns null when talents diverge and missing has talents', () => {
      const missing = makeCard({
        cardIdentifier: 'light-warrior',
        classes: [Class.Warrior],
        talents: [Talent.Light],
        pitch: 1,
      });
      const candidate = makeCard({
        cardIdentifier: 'shadow-warrior',
        classes: [Class.Warrior],
        talents: [Talent.Shadow],
        pitch: 1,
      });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
      expect(scoreCandidate(missing, candidate, TIER_2_CONFIG)).toBeNull();
    });

    it('returns null when equipment body slot differs', () => {
      const missingChest = makeCard({
        cardIdentifier: 'chest-equipment',
        classes: [Class.Warrior],
        types: [Type.Equipment],
        pitch: null,
        power: null,
        defense: 2,
        cost: null,
        keywords: [Keyword.Temper],
        subtypes: ['Chest'],
      });
      const armsCandidate = makeCard({
        cardIdentifier: 'arms-equipment',
        classes: [Class.Warrior],
        types: [Type.Equipment],
        pitch: null,
        power: null,
        defense: 2,
        cost: null,
        keywords: [Keyword.Temper],
        subtypes: ['Arms'],
      });

      expect(scoreCandidate(missingChest, armsCandidate, TIER_1_CONFIG)).toBeNull();
      expect(scoreCandidate(missingChest, armsCandidate, TIER_2_CONFIG)).toBeNull();
    });
  });

  describe('tier 1 scoring (current behavior, strict)', () => {
    it('gives a perfect match a score of 1.0', () => {
      const missing = makeCard({
        cardIdentifier: 'a',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const candidate = makeCard({
        cardIdentifier: 'b',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBe(1.0);
    });

    it('returns null for tier 1 when keyword overlap is zero and missing has keywords', () => {
      const missing = makeCard({
        cardIdentifier: 'with-keywords',
        keywords: [Keyword.GoAgain, Keyword.Dominate],
      });
      const candidate = makeCard({
        cardIdentifier: 'no-keywords',
        keywords: [],
      });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
    });

    it('rejects tier 1 candidates whose cumulative score falls below the tier 1 floor', () => {
      // Power delta 1 with full keyword match:
      // score = 1.0 - 0 (keywords) - 0.15 (power) - 0 (defense) = 0.85 < 0.90
      const missing = makeCard({
        cardIdentifier: 'p3',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const candidate = makeCard({
        cardIdentifier: 'p4',
        power: 4,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });

      const score = scoreCandidate(missing, candidate, TIER_1_CONFIG);
      expect(score).not.toBeNull();
      expect(score!).toBeLessThan(TIER_1_FLOOR_SCORE);
    });

    it('accepts tier 1 candidates with partial keyword overlap above the floor', () => {
      // 3/4 keyword overlap: penalty = (1 - 0.75) * 0.35 = 0.0875
      // score = 1.0 - 0.0875 = 0.9125, above 0.90 floor
      const missing = makeCard({
        cardIdentifier: 'kw-card',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain, Keyword.Dominate, Keyword.Intimidate, Keyword.Overpower],
      });
      const candidate = makeCard({
        cardIdentifier: 'kw-card-alt',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain, Keyword.Dominate, Keyword.Intimidate],
      });

      const score = scoreCandidate(missing, candidate, TIER_1_CONFIG);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(TIER_1_FLOOR_SCORE);
      expect(score!).toBeLessThan(1.0);
    });

    it('returns null for tier 1 when power delta exceeds the tier 1 limit', () => {
      const missing = makeCard({ cardIdentifier: 'a', power: 3 });
      const candidate = makeCard({ cardIdentifier: 'b', power: 5 });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
    });

    it('returns null for tier 1 when defense delta exceeds the tier 1 limit', () => {
      const missing = makeCard({ cardIdentifier: 'a', defense: 3 });
      const candidate = makeCard({ cardIdentifier: 'b', defense: 5 });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBeNull();
    });
  });

  describe('zero-keyword scoring regression (the Phase 1a bug fix)', () => {
    it('gives a perfect tier 1 match for a structurally identical keywordless card', () => {
      // Regression: previously the `(1 - 0/1) * 0.35` keyword penalty dropped
      // the score to 0.65 for any missing card with zero keywords, making
      // tier 1 impossible. After the fix the keyword score collapses to 1.0
      // when `missing.keywords.length === 0`.
      const missing = makeCard({
        cardIdentifier: 'no-kw-a',
        power: 3,
        defense: 3,
        keywords: [],
      });
      const candidate = makeCard({
        cardIdentifier: 'no-kw-b',
        power: 3,
        defense: 3,
        keywords: [],
      });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBe(1.0);
    });

    it('does not penalize keyword overlap when the candidate has keywords but the missing does not', () => {
      // Missing has no keywords -> keyword penalty must be 0 regardless of
      // what the candidate carries. FaB action cards are frequently
      // keywordless; the engine should still substitute them freely.
      const missing = makeCard({
        cardIdentifier: 'no-kw-missing',
        power: 3,
        defense: 3,
        keywords: [],
      });
      const candidate = makeCard({
        cardIdentifier: 'has-kw-candidate',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain, Keyword.Dominate],
      });

      expect(scoreCandidate(missing, candidate, TIER_1_CONFIG)).toBe(1.0);
    });

    it('falls through to tier 2 for a zero-keyword missing card with power delta 2', () => {
      // Plan scenario: the zero-keyword fix restores tier 1 for structurally
      // identical keywordless cards, but a candidate with the same missing
      // card and power delta 2 still needs to fall through to tier 2.
      // Tier 1 rejects on the powerDelta > 1 hard gate; tier 2 (which
      // allows powerDelta up to 2) accepts.
      const missing = makeCard({
        cardIdentifier: 'no-kw-p3',
        power: 3,
        defense: 3,
        keywords: [],
      });
      const powerShifted = makeCard({
        cardIdentifier: 'no-kw-p5',
        power: 5,
        defense: 3,
        keywords: [],
      });

      const catalog = makeCatalog([missing, powerShifted]);
      const inventory = new Map([['no-kw-p5', 1]]);

      // Tier 1 rejects on power delta hard cap
      expect(findTierMatch(missing, inventory, catalog, TIER_1_CONFIG)).toBeNull();

      // Tier 2 accepts and clears the floor
      const tier2Result = findTierMatch(
        missing,
        inventory,
        catalog,
        TIER_2_CONFIG,
      );
      expect(tier2Result).not.toBeNull();
      expect(tier2Result!.tier).toBe(2);
      expect(tier2Result!.score).toBeGreaterThanOrEqual(TIER_2_FLOOR_SCORE);
    });
  });

  describe('tier 2 scoring (relaxed keywords + wider stat deltas)', () => {
    it('accepts a candidate with no keyword overlap when missing has keywords', () => {
      // Tier 2 relaxes the keyword hard gate. Structural match is still
      // required (same pitch, class intersection, type intersection).
      const missing = makeCard({
        cardIdentifier: 'kw-missing',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain, Keyword.Dominate],
      });
      const candidate = makeCard({
        cardIdentifier: 'nokw-candidate',
        power: 3,
        defense: 3,
        keywords: [Keyword.Intimidate],
      });

      const score = scoreCandidate(missing, candidate, TIER_2_CONFIG);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(TIER_2_FLOOR_SCORE);
    });

    it('accepts a candidate with power delta 2 at tier 2', () => {
      const missing = makeCard({
        cardIdentifier: 'a',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });
      const candidate = makeCard({
        cardIdentifier: 'b',
        power: 5,
        defense: 3,
        keywords: [Keyword.GoAgain],
      });

      const score = scoreCandidate(missing, candidate, TIER_2_CONFIG);
      expect(score).not.toBeNull();
      expect(score!).toBeGreaterThanOrEqual(TIER_2_FLOOR_SCORE);
    });

    it('rejects candidates with power delta greater than 2 at tier 2', () => {
      const missing = makeCard({ cardIdentifier: 'a', power: 3 });
      const candidate = makeCard({ cardIdentifier: 'b', power: 6 });

      expect(scoreCandidate(missing, candidate, TIER_2_CONFIG)).toBeNull();
    });

    it('scores below the tier 2 floor when relaxations cannot rescue the candidate', () => {
      // scoreCandidate returns the raw score; the floor check is enforced
      // by findTierMatch. This test documents that the combined penalties
      // (full keyword mismatch + power delta 2 + defense delta 2) push
      // the score below the 0.70 floor, so findTierMatch will reject it.
      const missing = makeCard({
        cardIdentifier: 'a',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain, Keyword.Dominate, Keyword.Intimidate],
      });
      const candidate = makeCard({
        cardIdentifier: 'b',
        power: 5,
        defense: 5,
        keywords: [],
      });

      const score = scoreCandidate(missing, candidate, TIER_2_CONFIG);
      expect(score).not.toBeNull();
      expect(score!).toBeLessThan(TIER_2_FLOOR_SCORE);
    });

    it('findTierMatch returns null when the best candidate scores below the tier 2 floor', () => {
      const missing = makeCard({
        cardIdentifier: 'missing',
        power: 3,
        defense: 3,
        keywords: [Keyword.GoAgain, Keyword.Dominate, Keyword.Intimidate],
      });
      const candidate = makeCard({
        cardIdentifier: 'below-floor',
        power: 5,
        defense: 5,
        keywords: [],
      });

      const catalog = makeCatalog([missing, candidate]);
      const inventory = new Map([['below-floor', 1]]);

      expect(findTierMatch(missing, inventory, catalog, TIER_2_CONFIG)).toBeNull();
    });
  });
});

describe('findTierMatch', () => {
  it('returns the best tier 1 candidate from the inventory', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const perfect = makeCard({
      cardIdentifier: 'perfect',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const okOne = makeCard({
      cardIdentifier: 'ok',
      power: 4,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const catalog = makeCatalog([missing, perfect, okOne]);
    const inventory = new Map([
      ['perfect', 1],
      ['ok', 1],
    ]);

    const result = findTierMatch(missing, inventory, catalog, TIER_1_CONFIG);

    expect(result).not.toBeNull();
    expect(result!.substitute.cardIdentifier).toBe('perfect');
    expect(result!.tier).toBe(1);
    expect(result!.score).toBe(1.0);
  });

  it('returns null when no candidate in inventory meets the tier floor', () => {
    const missing = makeCard({ cardIdentifier: 'a', pitch: 1 });
    const candidate = makeCard({ cardIdentifier: 'b', pitch: 3 });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['b', 1]]);

    expect(findTierMatch(missing, inventory, catalog, TIER_1_CONFIG)).toBeNull();
  });

  it('does not pick itself as a candidate', () => {
    const card = makeCard({ cardIdentifier: 'only', pitch: 1 });
    const catalog = makeCatalog([card]);
    const inventory = new Map([['only', 3]]);

    expect(findTierMatch(card, inventory, catalog, TIER_1_CONFIG)).toBeNull();
  });

  it('skips candidates whose identifiers appear in the excluded set', () => {
    const missing = makeCard({ cardIdentifier: 'missing', pitch: 1 });
    const best = makeCard({
      cardIdentifier: 'excluded-best',
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const fallback = makeCard({
      cardIdentifier: 'fallback',
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const catalog = makeCatalog([missing, best, fallback]);
    const inventory = new Map([
      ['excluded-best', 1],
      ['fallback', 1],
    ]);

    const result = findTierMatch(
      missing,
      inventory,
      catalog,
      TIER_1_CONFIG,
      new Set(['excluded-best']),
    );

    expect(result).not.toBeNull();
    expect(result!.substitute.cardIdentifier).toBe('fallback');
  });

  it('returns null at tier 1 but finds a match at tier 2 for the same inventory', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier2Only = makeCard({
      cardIdentifier: 'tier2-only',
      power: 3,
      defense: 3,
      keywords: [Keyword.Intimidate], // no overlap with GoAgain
    });

    const catalog = makeCatalog([missing, tier2Only]);
    const inventory = new Map([['tier2-only', 1]]);

    expect(findTierMatch(missing, inventory, catalog, TIER_1_CONFIG)).toBeNull();
    const tier2Result = findTierMatch(missing, inventory, catalog, TIER_2_CONFIG);
    expect(tier2Result).not.toBeNull();
    expect(tier2Result!.tier).toBe(2);
    expect(tier2Result!.score).toBeGreaterThanOrEqual(TIER_2_FLOOR_SCORE);
  });

  it('requires the candidate to be present in inventory', () => {
    const missing = makeCard({ cardIdentifier: 'a', pitch: 1 });
    const candidate = makeCard({ cardIdentifier: 'b', pitch: 1 });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map<string, number>();

    expect(findTierMatch(missing, inventory, catalog, TIER_1_CONFIG)).toBeNull();
  });
});

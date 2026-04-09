import { tier1Substitution } from '../src/substitution/tier1';
import { DEFAULT_PITCH_TOLERANCE, TIER_1_FLOOR_SCORE } from '../src/substitution/constants';
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

describe('tier1Substitution', () => {
  it('finds a valid tier 1 substitute with matching class, pitch, type, and keywords', () => {
    const missing = makeCard({
      cardIdentifier: 'warrior-action-red-a',
      classes: [Class.Warrior],
      types: [Type.Action],
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const candidate = makeCard({
      cardIdentifier: 'warrior-action-red-b',
      classes: [Class.Warrior],
      types: [Type.Action],
      pitch: 1,
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['warrior-action-red-b', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).not.toBeNull();
    expect(result!.substitute.cardIdentifier).toBe('warrior-action-red-b');
    expect(result!.tier).toBe(1);
    expect(result!.score).toBeGreaterThanOrEqual(TIER_1_FLOOR_SCORE);
    expect(result!.rationale).toContain('Same pitch (red)');
  });

  it('returns null when candidate has different pitch', () => {
    const missing = makeCard({
      cardIdentifier: 'warrior-action-red',
      pitch: 1,
    });

    const candidate = makeCard({
      cardIdentifier: 'warrior-action-blue',
      pitch: 3,
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['warrior-action-blue', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('returns null when candidate has different class', () => {
    const missing = makeCard({
      cardIdentifier: 'warrior-card',
      classes: [Class.Warrior],
      pitch: 1,
    });

    const candidate = makeCard({
      cardIdentifier: 'wizard-card',
      classes: [Class.Wizard],
      pitch: 1,
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['wizard-card', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('returns null when candidate has no keyword overlap and missing has keywords', () => {
    const missing = makeCard({
      cardIdentifier: 'card-with-keywords',
      keywords: [Keyword.GoAgain, Keyword.Dominate],
      pitch: 1,
    });

    const candidate = makeCard({
      cardIdentifier: 'card-no-keywords',
      keywords: [],
      pitch: 1,
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['card-no-keywords', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('returns null when power delta exceeds 1', () => {
    const missing = makeCard({
      cardIdentifier: 'power-3-card',
      power: 3,
      pitch: 1,
    });

    const candidate = makeCard({
      cardIdentifier: 'power-5-card',
      power: 5,
      pitch: 1,
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['power-5-card', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('returns null when defense delta exceeds 1', () => {
    const missing = makeCard({
      cardIdentifier: 'defense-3-card',
      defense: 3,
      pitch: 1,
    });

    const candidate = makeCard({
      cardIdentifier: 'defense-5-card',
      defense: 5,
      pitch: 1,
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['defense-5-card', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('returns null when candidate is not in inventory', () => {
    const missing = makeCard({
      cardIdentifier: 'missing-card',
      pitch: 1,
    });

    const candidate = makeCard({
      cardIdentifier: 'not-owned-card',
      pitch: 1,
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map<string, number>();

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('rejects a candidate whose combined penalties drop score below floor', () => {
    // Power delta 1 with full keyword match:
    // score = 1.0 - 0 (keywords) - 0.15 (power) - 0 (defense) = 0.85 < 0.90
    const missing = makeCard({
      cardIdentifier: 'power-3-card',
      power: 3,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain],
    });

    const candidate = makeCard({
      cardIdentifier: 'power-4-card',
      power: 4,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain],
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['power-4-card', 1]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('accepts a candidate with partial keyword overlap above floor', () => {
    // 3/4 keyword overlap: penalty = (1 - 0.75) * 0.35 = 0.0875
    // score = 1.0 - 0.0875 = 0.9125, above 0.90 floor
    const missing = makeCard({
      cardIdentifier: 'kw-card',
      power: 3,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain, Keyword.Dominate, Keyword.Intimidate, Keyword.Overpower],
    });

    const candidate = makeCard({
      cardIdentifier: 'kw-card-alt',
      power: 3,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain, Keyword.Dominate, Keyword.Intimidate],
    });

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['kw-card-alt', 1]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(1.0);
    expect(result!.score).toBeGreaterThanOrEqual(TIER_1_FLOOR_SCORE);
  });

  it('requires talent intersection when missing card has talents', () => {
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

    const catalog = makeCatalog([missing, candidate]);
    const inventory = new Map([['shadow-warrior', 2]]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('does not skip self as a candidate', () => {
    const card = makeCard({
      cardIdentifier: 'only-card',
      pitch: 1,
    });

    const catalog = makeCatalog([card]);
    const inventory = new Map([['only-card', 3]]);

    // Searching for a substitute for itself -- should return null since the only candidate is self
    const result = tier1Substitution(card, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('picks the highest-scoring candidate when multiple are available', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain],
    });

    // Perfect match
    const perfectCandidate = makeCard({
      cardIdentifier: 'perfect-match',
      power: 3,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain],
    });

    // Slightly worse -- power off by 1
    const okCandidate = makeCard({
      cardIdentifier: 'ok-match',
      power: 4,
      defense: 3,
      pitch: 1,
      keywords: [Keyword.GoAgain],
    });

    const catalog = makeCatalog([missing, perfectCandidate, okCandidate]);
    const inventory = new Map([
      ['perfect-match', 1],
      ['ok-match', 1],
    ]);

    const result = tier1Substitution(missing, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).not.toBeNull();
    expect(result!.substitute.cardIdentifier).toBe('perfect-match');
  });

  it('rejects equipment substitute with different body slot (e.g. Chest vs Arms)', () => {
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

    const catalog = makeCatalog([missingChest, armsCandidate]);
    const inventory = new Map([['arms-equipment', 1]]);

    const result = tier1Substitution(missingChest, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).toBeNull();
  });

  it('accepts equipment substitute with matching body slot', () => {
    const missingArms = makeCard({
      cardIdentifier: 'arms-equipment-a',
      classes: [Class.Warrior],
      types: [Type.Equipment],
      pitch: null,
      power: null,
      defense: 2,
      cost: null,
      keywords: [Keyword.Temper],
      subtypes: ['Arms'],
    });

    const armsCandidate = makeCard({
      cardIdentifier: 'arms-equipment-b',
      classes: [Class.Warrior],
      types: [Type.Equipment],
      pitch: null,
      power: null,
      defense: 2,
      cost: null,
      keywords: [Keyword.Temper],
      subtypes: ['Arms'],
    });

    const catalog = makeCatalog([missingArms, armsCandidate]);
    const inventory = new Map([['arms-equipment-b', 1]]);

    const result = tier1Substitution(missingArms, inventory, catalog, DEFAULT_PITCH_TOLERANCE);

    expect(result).not.toBeNull();
    expect(result!.substitute.cardIdentifier).toBe('arms-equipment-b');
  });
});

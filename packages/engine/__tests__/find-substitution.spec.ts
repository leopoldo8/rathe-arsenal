import { findSubstitution } from '../src/substitution/find-substitution';
import { ICatalog, ICatalogCard, Class, Format, Keyword, Rarity, Talent, Type } from '../src';
import { buildIndices } from '../src/catalog/indices';

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

describe('findSubstitution (tiered search)', () => {
  it('prefers a tier 1 match over a tier 2 match even when both exist', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier1Candidate = makeCard({
      cardIdentifier: 'tier1',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier2Candidate = makeCard({
      cardIdentifier: 'tier2',
      power: 3,
      defense: 3,
      keywords: [Keyword.Intimidate], // zero overlap, tier 2 only
    });

    const catalog = makeCatalog([missing, tier1Candidate, tier2Candidate]);
    const inventory = new Map([
      ['tier1', 1],
      ['tier2', 1],
    ]);

    const result = findSubstitution(missing, inventory, catalog);

    expect(result).not.toBeNull();
    expect(result!.tier).toBe(1);
    expect(result!.substitute.cardIdentifier).toBe('tier1');
  });

  it('falls through to tier 2 when no tier 1 candidate is available', () => {
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
      keywords: [Keyword.Intimidate], // blocked at tier 1
    });

    const catalog = makeCatalog([missing, tier2Only]);
    const inventory = new Map([['tier2-only', 1]]);

    const result = findSubstitution(missing, inventory, catalog);

    expect(result).not.toBeNull();
    expect(result!.tier).toBe(2);
    expect(result!.substitute.cardIdentifier).toBe('tier2-only');
  });

  it('returns null when neither tier 1 nor tier 2 finds a candidate', () => {
    const missing = makeCard({ cardIdentifier: 'a', pitch: 1 });
    const badCandidate = makeCard({
      cardIdentifier: 'b',
      pitch: 3, // pitch hard constraint fails at both tiers
    });

    const catalog = makeCatalog([missing, badCandidate]);
    const inventory = new Map([['b', 1]]);

    expect(findSubstitution(missing, inventory, catalog)).toBeNull();
  });

  it('honors excludedIdentifiers at both tiers', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier1Best = makeCard({
      cardIdentifier: 'tier1-best',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier2Fallback = makeCard({
      cardIdentifier: 'tier2-fallback',
      power: 3,
      defense: 3,
      keywords: [Keyword.Intimidate],
    });

    const catalog = makeCatalog([missing, tier1Best, tier2Fallback]);
    const inventory = new Map([
      ['tier1-best', 1],
      ['tier2-fallback', 1],
    ]);

    // Without exclusion -> tier 1 match
    const unrestricted = findSubstitution(missing, inventory, catalog);
    expect(unrestricted).not.toBeNull();
    expect(unrestricted!.tier).toBe(1);

    // Excluding the tier 1 best candidate should fall through to tier 2
    const restricted = findSubstitution(
      missing,
      inventory,
      catalog,
      new Set(['tier1-best']),
    );
    expect(restricted).not.toBeNull();
    expect(restricted!.tier).toBe(2);
    expect(restricted!.substitute.cardIdentifier).toBe('tier2-fallback');
  });

  it('returns null when every candidate at every tier is excluded', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const onlyCandidate = makeCard({
      cardIdentifier: 'only',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });

    const catalog = makeCatalog([missing, onlyCandidate]);
    const inventory = new Map([['only', 1]]);

    expect(
      findSubstitution(missing, inventory, catalog, new Set(['only'])),
    ).toBeNull();
  });

  it('produces a tier 2 rationale string that identifies the softer match', () => {
    const missing = makeCard({
      cardIdentifier: 'missing',
      power: 3,
      defense: 3,
      keywords: [Keyword.GoAgain],
    });
    const tier2Only = makeCard({
      cardIdentifier: 'tier2',
      power: 3,
      defense: 3,
      keywords: [Keyword.Intimidate],
    });

    const catalog = makeCatalog([missing, tier2Only]);
    const inventory = new Map([['tier2', 1]]);

    const result = findSubstitution(missing, inventory, catalog);

    expect(result).not.toBeNull();
    expect(result!.tier).toBe(2);
    expect(result!.rationale).toContain('Tier 2 substitute');
  });
});

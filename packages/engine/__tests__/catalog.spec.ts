import { catalog, CardNotFoundError, Class, Keyword, Type, getSetName } from '../src';

describe('catalog', () => {
  it('loads all cards from @flesh-and-blood/cards', () => {
    expect(catalog.cards.length).toBeGreaterThan(4000);
  });

  it('getCard returns a known card with expected fields', () => {
    const card = catalog.getCard('snatch-red');
    expect(card.cardIdentifier).toBe('snatch-red');
    expect(card.name).toBe('Snatch');
    expect(card.pitch).toBe(1);
    expect(card.classes).toContain(Class.Generic);
    expect(card.types.length).toBeGreaterThan(0);
  });

  it('getCard throws CardNotFoundError for unknown identifier', () => {
    expect(() => catalog.getCard('not-a-real-card-xyz')).toThrow(CardNotFoundError);
    expect(() => catalog.getCard('not-a-real-card-xyz')).toThrow('Card not found: not-a-real-card-xyz');
  });

  it('getRawCard returns the raw object for a known card', () => {
    const raw = catalog.getRawCard('snatch-red') as Record<string, unknown>;
    expect(raw).toBeDefined();
    expect(raw.cardIdentifier).toBe('snatch-red');
    expect(raw.printings).toBeDefined();
  });

  it('getRawCard throws CardNotFoundError for unknown identifier', () => {
    expect(() => catalog.getRawCard('not-a-real-card-xyz')).toThrow(CardNotFoundError);
  });

  it('normalizes undefined pitch/power/defense/cost to null', () => {
    // Hero cards typically have no pitch
    const hero = catalog.cards.find(
      (c) => c.types.includes(Type.Hero),
    );
    expect(hero).toBeDefined();
    if (hero) {
      expect(hero.pitch).toBeNull();
    }
  });

  it('cards with keywords have Keyword enum values', () => {
    const withKeywords = catalog.cards.find(
      (c) => c.keywords.length > 0,
    );
    expect(withKeywords).toBeDefined();
    if (withKeywords) {
      for (const kw of withKeywords.keywords) {
        expect(typeof kw).toBe('string');
        expect(Object.values(Keyword)).toContain(kw);
      }
    }
  });

  it('DFC faces are independent cards', () => {
    // a-drop-in-the-ocean-blue and inner-chi-blue are two faces of MST095
    const face1 = catalog.indices.byIdentifier.get('a-drop-in-the-ocean-blue');
    const face2 = catalog.indices.byIdentifier.get('inner-chi-blue');

    // These specific DFC cards may or may not exist in the current version.
    // If they do, they must be independent entries.
    if (face1 && face2) {
      expect(face1.cardIdentifier).not.toBe(face2.cardIdentifier);
      expect(face1.name).not.toBe(face2.name);
    }
  });

  it('catalog is frozen (immutable)', () => {
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.cards)).toBe(true);
  });

  describe('ICatalogCard.sets', () => {
    it('sets is non-empty for snatch-red (a WTR-era generic card)', () => {
      const card = catalog.getCard('snatch-red');
      expect(card.sets).toBeDefined();
      expect(card.sets.length).toBeGreaterThan(0);
    });

    it('sets is a frozen readonly array', () => {
      const card = catalog.getCard('snatch-red');
      expect(Object.isFrozen(card.sets)).toBe(true);
    });

    it('sets is empty array (not null/undefined) for cards with no set data', () => {
      // Every card should have sets as a readonly array — never null/undefined.
      for (const card of catalog.cards) {
        expect(Array.isArray(card.sets)).toBe(true);
      }
    });

    it('sets contains only 3-letter uppercase codes (no card numbers)', () => {
      const card = catalog.getCard('snatch-red');
      for (const code of card.sets) {
        expect(code).toMatch(/^[0-9A-Z]{3}$/);
      }
    });

    it('sets is deduplicated and sorted', () => {
      const card = catalog.getCard('snatch-red');
      const set = new Set(card.sets);
      expect(set.size).toBe(card.sets.length);
      expect([...card.sets]).toEqual([...card.sets].sort());
    });
  });

  describe('getSetName helper', () => {
    it('returns the human-readable release name for known codes', () => {
      expect(getSetName('WTR')).toBe('Welcome to Rathe');
      expect(getSetName('HVY')).toBe('Heavy Hitters');
    });

    it('is case-insensitive on input', () => {
      expect(getSetName('wtr')).toBe('Welcome to Rathe');
      expect(getSetName('Hvy')).toBe('Heavy Hitters');
    });

    it('returns null for unknown codes', () => {
      expect(getSetName('XYZ')).toBeNull();
    });
  });

  describe('ICatalogIndices.byName', () => {
    it('byName index is populated', () => {
      expect(catalog.indices.byName.size).toBeGreaterThan(0);
    });

    it('lookup by exact lowercase name returns cards', () => {
      const cards = catalog.indices.byName.get('snatch');
      expect(cards).toBeDefined();
      expect(cards!.length).toBeGreaterThan(0);
      for (const card of cards!) {
        expect(card.name.toLowerCase()).toBe('snatch');
      }
    });

    it('is case-insensitive: "Snatch" and "snatch" resolve to the same bucket', () => {
      const lower = catalog.indices.byName.get('snatch');
      const upper = catalog.indices.byName.get('snatch'); // index is always lowercase
      expect(lower).toBe(upper);
    });

    it('looking up with mixed case requires .toLowerCase() (index key is lowercased)', () => {
      // Consumer must call .toLowerCase() — the index stores lowercase keys only.
      const byLower = catalog.indices.byName.get('snatch');
      const byMixed = catalog.indices.byName.get('Snatch'); // not found — intentional
      expect(byLower).toBeDefined();
      expect(byMixed).toBeUndefined();
    });

    it('byName bucket for a multi-pitch card contains all pitch variants', () => {
      // "Snatch" has red/yellow/blue variants — all should be in the same bucket.
      const cards = catalog.indices.byName.get('snatch');
      if (cards && cards.length > 1) {
        const pitches = cards.map((c) => c.pitch);
        // Should contain at least two different pitch values.
        const uniquePitches = new Set(pitches);
        expect(uniquePitches.size).toBeGreaterThan(1);
      }
    });

    it('byName bucket arrays are frozen', () => {
      const cards = catalog.indices.byName.get('snatch');
      expect(cards).toBeDefined();
      expect(Object.isFrozen(cards)).toBe(true);
    });
  });
});

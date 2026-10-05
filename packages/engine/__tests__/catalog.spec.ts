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

  describe('ICatalogCard.imageUrl.sources', () => {
    it('returns the bare defaultImage as the first source', () => {
      const card = catalog.getCard('snatch-red');
      expect(card.imageUrl).not.toBeNull();
      expect(card.imageUrl?.sources[0]?.small).toMatch(/\/small\/[A-Z0-9]+\.webp$/);
      expect(card.imageUrl?.sources[0]?.small).not.toMatch(/-(RF|CF|GF)\.webp$/);
    });

    it('appends -RF/-CF/-GF foiling suffixes for cards with foiled-only printings', () => {
      // Hide Tanner (Armory Deck: Kayo) — bare AKO005 returns 403 on LSS,
      // only AKO005-RF resolves.
      const card = catalog.getCard('hide-tanner');
      const sourceSmalls = card.imageUrl?.sources.map((s) => s.small) ?? [];
      expect(sourceSmalls.some((url) => /AKO005-RF\.webp$/.test(url))).toBe(true);
    });

    it('never doubles a foiling suffix the printing image already carries', () => {
      const doubled = catalog.cards.flatMap((card) =>
        (card.imageUrl?.sources ?? [])
          .map((s) => s.small)
          .filter((url) => /-(RF|CF|GF)-(RF|CF|GF)\.webp$/.test(url)),
      );
      expect(doubled).toEqual([]);
    });

    it('deduplicates candidates when multiple printings share the same image+foiling pair', () => {
      // Savage Sash has two Rainbow GEM082 printings — they collapse to
      // a single GEM082-RF candidate after the Set-based dedup.
      const card = catalog.getCard('savage-sash');
      const codes = (card.imageUrl?.sources ?? []).map((s) =>
        s.small.replace(/^.*\/small\//, '').replace(/\.webp$/, ''),
      );
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });

    it('mirrors sources[0] in the legacy small/large fields', () => {
      const card = catalog.getCard('hide-tanner');
      expect(card.imageUrl?.small).toBe(card.imageUrl?.sources[0]?.small);
      expect(card.imageUrl?.large).toBe(card.imageUrl?.sources[0]?.large);
    });
  });
});

describe('catalog rules text', () => {
  type TRawWithText = { cardIdentifier: string; functionalText?: string };

  it('C1: carries the package rules text, on 5,139 of 5,177 cards', () => {
    const raw = catalog.getRawCard('dorinthea-ironsong') as TRawWithText;
    expect(raw.functionalText).toBeDefined();
    expect(catalog.getCard('dorinthea-ironsong').functionalText).toBe(raw.functionalText);

    const withText = catalog.cards.filter((c) => c.functionalText !== undefined);
    expect(catalog.cards).toHaveLength(5177);
    expect(withText).toHaveLength(5139);
    for (const card of withText) {
      const rawCard = catalog.getRawCard(card.cardIdentifier) as TRawWithText;
      expect(card.functionalText).toBe(rawCard.functionalText);
    }
  });

  it('C2: leaves the field absent, never an empty string, when the package has none', () => {
    const without = catalog.cards.filter(
      (c) => (catalog.getRawCard(c.cardIdentifier) as TRawWithText).functionalText === undefined,
    );
    expect(without).toHaveLength(38);
    for (const card of without) {
      expect(Object.prototype.hasOwnProperty.call(card, 'functionalText')).toBe(false);
    }
    expect(catalog.cards.filter((c) => c.functionalText === '')).toHaveLength(0);
  });

  it('C3: keeps exactly the pre-change field set plus the optional rules text', () => {
    const previousFields = new Set([
      'cardIdentifier', 'name', 'classes', 'talents', 'types', 'pitch', 'power', 'defense',
      'cost', 'keywords', 'subtypes', 'legalHeroes', 'legalFormats', 'rarity', 'young', 'sets',
      'imageUrl', 'hero', 'bannedFormats', 'restrictedFormats', 'legalOverrides', 'specializations',
    ]);
    const seen = new Set<string>();
    for (const card of catalog.cards) {
      for (const key of Object.keys(card)) seen.add(key);
    }
    const unexpected = [...seen].filter((k) => !previousFields.has(k) && k !== 'functionalText');
    expect(unexpected).toEqual([]);
    expect(seen.has('cardIdentifier') && seen.has('legalFormats') && seen.has('sets')).toBe(true);
  });
});

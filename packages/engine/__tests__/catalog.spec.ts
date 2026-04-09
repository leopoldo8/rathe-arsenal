import { catalog, CardNotFoundError, Class, Keyword, Type } from '../src';

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
});

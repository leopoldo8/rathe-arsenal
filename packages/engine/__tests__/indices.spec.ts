import { catalog, Class } from '../src';

describe('catalog indices', () => {
  const { indices } = catalog;

  describe('byIdentifier', () => {
    it('has the same size as the cards array', () => {
      expect(indices.byIdentifier.size).toBe(catalog.cards.length);
    });

    it('maps cardIdentifier to the correct card', () => {
      const card = indices.byIdentifier.get('snatch-red');
      expect(card).toBeDefined();
      expect(card!.name).toBe('Snatch');
    });
  });

  describe('byClassAndPitch', () => {
    it('returns non-empty array for Warrior:1 (red pitch warriors)', () => {
      const warriors = indices.byClassAndPitch.get(`${Class.Warrior}:1`);
      expect(warriors).toBeDefined();
      expect(warriors!.length).toBeGreaterThan(0);

      for (const card of warriors!) {
        expect(card.classes).toContain(Class.Warrior);
        expect(card.pitch).toBe(1);
      }
    });

    it('returns non-empty array for Generic:1 (red pitch generic cards)', () => {
      const generics = indices.byClassAndPitch.get(`${Class.Generic}:1`);
      expect(generics).toBeDefined();
      expect(generics!.length).toBeGreaterThan(0);
    });

    it('indexes multi-class cards under all their classes', () => {
      const multiClass = catalog.cards.find(
        (c) => c.classes.length > 1 && c.pitch !== null,
      );
      if (multiClass) {
        for (const cls of multiClass.classes) {
          const key = `${cls}:${multiClass.pitch}`;
          const bucket = indices.byClassAndPitch.get(key);
          expect(bucket).toBeDefined();
          expect(bucket).toContain(multiClass);
        }
      }
    });

    it('indexes cards with null pitch under class:null', () => {
      const nullPitch = catalog.cards.find(
        (c) => c.pitch === null && c.classes.length > 0,
      );
      if (nullPitch) {
        const key = `${nullPitch.classes[0]}:null`;
        const bucket = indices.byClassAndPitch.get(key);
        expect(bucket).toBeDefined();
        expect(bucket).toContain(nullPitch);
      }
    });
  });

  describe('byTypeAndClass', () => {
    it('returns non-empty array for Action:Generic', () => {
      const actions = indices.byTypeAndClass.get('Action:Generic');
      expect(actions).toBeDefined();
      expect(actions!.length).toBeGreaterThan(0);
    });

    it('returns non-empty array for Hero (hero type entries exist)', () => {
      // Heroes should be indexed
      let found = false;
      for (const [key] of indices.byTypeAndClass) {
        if (key.startsWith('Hero:')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });
});

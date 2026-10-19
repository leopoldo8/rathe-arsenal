import { ICatalogCard } from '@rathe-arsenal/engine';
import { resolveHeroCard, TCatalogLookup } from '../shared-deck-cards';

const HERO = {
  cardIdentifier: 'rhinar-reckless-rampage',
  name: 'Rhinar, Reckless Rampage',
  pitch: null,
  types: ['Hero'],
  imageUrl: { small: 's.webp', large: 'l.webp', sources: [] },
} as unknown as ICatalogCard;

const lookup: TCatalogLookup = (id) => (id === HERO.cardIdentifier ? HERO : undefined);

describe('resolveHeroCard', () => {
  it('uses the deck hero row when the deck has one', () => {
    const rows = [
      { cardIdentifier: 'pack-hunt-red', quantity: 3, slot: 'mainboard' },
      { cardIdentifier: HERO.cardIdentifier, quantity: 1, slot: 'hero' },
    ];

    expect(resolveHeroCard(rows, null, lookup)).toMatchObject({ cardIdentifier: HERO.cardIdentifier, slot: 'hero' });
  });

  it('falls back to the catalog for a scratch deck that only carries the hero identifier', () => {
    const hero = resolveHeroCard([], HERO.cardIdentifier, lookup);

    expect(hero).toMatchObject({ name: HERO.name, slot: 'hero', quantity: 1 });
    expect(hero?.imageUrl?.large).toBe('l.webp');
  });

  it('returns null when the hero is unknown or absent', () => {
    expect(resolveHeroCard([], 'not-a-card', lookup)).toBeNull();
    expect(resolveHeroCard([], null, lookup)).toBeNull();
  });
});

import { catalog, Format, Hero } from '@rathe-arsenal/engine';
import { cardLegalityFacts } from '../card-legality-facts';

describe('cardLegalityFacts', () => {
  it('carries the Legendary keyword, the restricted list and plain legal formats', () => {
    const legendary = cardLegalityFacts(catalog.getCard('a-drop-in-the-ocean-blue'));
    const restricted = cardLegalityFacts(catalog.getCard('bonds-of-ancestry-red'));

    expect(legendary.legendary).toBe(true);
    expect(legendary.legalFormats).toContain('Silver Age');
    expect(restricted).toMatchObject({ legendary: false, restrictedFormats: ['Living Legend'] });
  });

  it('carries the hero scope: specializations and per-format overrides', () => {
    const specialist = cardLegalityFacts(catalog.getCard('arknight-shard-blue'));
    const overridden = cardLegalityFacts({
      ...catalog.getCard('adrenaline-rush-red'),
      legalOverrides: [{ format: Format.Blitz, heroes: [Hero.Rhinar] }],
    });

    expect(specialist.specializations).toEqual(['Viserai']);
    expect(overridden.legalOverrides).toEqual([{ format: 'Blitz', heroes: ['Rhinar'] }]);
  });

  it('serializes every list, never undefined', () => {
    const plain = cardLegalityFacts(catalog.getCard('adrenaline-rush-red'));

    expect(plain).toMatchObject({ bannedFormats: [], restrictedFormats: [], legalOverrides: [], specializations: [] });
  });
});

import { catalog } from '../../src/catalog/catalog';
import type { ICatalogCard } from '../../src/catalog/types';
import { Format } from '../../src/catalog/types';
import {
  findCardLegalityViolation,
  findCardRarityViolation,
  getCopyLimit,
} from '../../src/legality/card-legality';
import type { TSupportedFormat } from '../../src/legality/types';

const KATSU_ADULT = catalog.getCard('katsu-the-wanderer');
const KATSU_YOUNG = catalog.getCard('katsu');

interface IRuleCase {
  readonly rule: string;
  readonly slot: 'mainboard' | 'equipment';
  readonly cardIdentifier: string;
  readonly hero: ICatalogCard;
  readonly format: TSupportedFormat;
  readonly code: string;
}

// Real catalog cards, one per rule and slot. The Silver Age rarity rows use cards the
// catalog already leaves out of Silver Age, so the format rule reports them first.
const RULE_CASES: readonly IRuleCase[] = [
  { rule: 'banned', slot: 'mainboard', cardIdentifier: 'art-of-war-yellow', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_banned' },
  { rule: 'banned', slot: 'equipment', cardIdentifier: 'bloodsheath-skeleta', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_banned' },
  { rule: 'not legal in the format', slot: 'mainboard', cardIdentifier: 'drinking-buddy-red', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_in_format' },
  { rule: 'not legal in the format', slot: 'equipment', cardIdentifier: 'diamond-hands', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_in_format' },
  { rule: 'not legal for the hero', slot: 'mainboard', cardIdentifier: 'a-good-clean-fight-red', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_for_hero' },
  { rule: 'not legal for the hero', slot: 'equipment', cardIdentifier: 'achilles-accelerator', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_for_hero' },
  { rule: 'outside Silver Age rarities', slot: 'mainboard', cardIdentifier: 'amethyst-amulet-blue', hero: KATSU_YOUNG, format: 'Silver Age', code: 'card_not_in_format' },
  { rule: 'outside Silver Age rarities', slot: 'equipment', cardIdentifier: 'bloodsheath-skeleta', hero: KATSU_YOUNG, format: 'Silver Age', code: 'card_not_in_format' },
];

describe('per-card legality', () => {
  it.each(RULE_CASES)(
    'rejects each per-card rule in mainboard and equipment: $rule in $slot ($cardIdentifier)',
    ({ cardIdentifier, hero, format, code }) => {
      const violation = findCardLegalityViolation(catalog.getCard(cardIdentifier), hero, format);

      expect(violation?.detail.code).toBe(code);
      expect(violation?.reason).toContain(catalog.getCard(cardIdentifier).name);
    },
  );

  it('accepts a card that breaks no rule', () => {
    const emissary = catalog.getCard('emissary-of-tides-red');

    expect(findCardLegalityViolation(emissary, KATSU_ADULT, 'Classic Constructed')).toBeNull();
  });

  it('applies the Silver Age rarity whitelist to a card the format otherwise allows', () => {
    const majestic = catalog.getCard('amethyst-amulet-blue');
    const allowedByFormat: ICatalogCard = { ...majestic, legalFormats: [...majestic.legalFormats, Format.SilverAge] };

    expect(findCardRarityViolation(allowedByFormat, 'Silver Age')?.detail).toEqual({
      code: 'rarity_not_allowed',
      params: { card: 'Amethyst Amulet', rarity: 'Majestic', format: 'Silver Age', allowed: 'Common, Rare, Basic' },
    });
    expect(findCardRarityViolation(allowedByFormat, 'Classic Constructed')).toBeNull();
  });

  it.each([
    ['a regular card in Classic Constructed', 'emissary-of-tides-red', 'Classic Constructed', 3],
    ['a regular card in Blitz', 'emissary-of-tides-red', 'Blitz', 2],
    ['a Legendary card', 'amethyst-amulet-blue', 'Classic Constructed', 1],
  ] as const)('caps copies per card: %s', (_label, cardIdentifier, format, limit) => {
    const card = catalog.getCard(cardIdentifier);

    expect(getCopyLimit(card, format)).toBe(limit);
  });
});

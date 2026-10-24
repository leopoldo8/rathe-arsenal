import { catalog } from '../../src/catalog/catalog';
import type { ICatalogCard } from '../../src/catalog/types';
import { computeDeckLegality } from '../../src/legality/compute';
import { findCardLegalityViolation, getCopyLimit, isLegendary } from '../../src/legality/card-legality';
import { Keyword } from '../../src/catalog/types';
import type { ILegalityDeck, TSupportedFormat } from '../../src/legality/types';

const KATSU_ADULT = catalog.getCard('katsu-the-wanderer');
const SILVER_AGE_HERO = catalog.getCard('dorinthea-quicksilver-prodigy');

interface IRuleCase {
  readonly rule: string;
  readonly slot: 'mainboard' | 'equipment';
  readonly cardIdentifier: string;
  readonly hero: ICatalogCard;
  readonly format: TSupportedFormat;
  readonly code: string;
}

// Real catalog cards, one per rule and slot.
const RULE_CASES: readonly IRuleCase[] = [
  { rule: 'banned', slot: 'mainboard', cardIdentifier: 'art-of-war-yellow', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_banned' },
  { rule: 'banned', slot: 'equipment', cardIdentifier: 'bloodsheath-skeleta', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_banned' },
  { rule: 'not legal in the format', slot: 'mainboard', cardIdentifier: 'drinking-buddy-red', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_in_format' },
  { rule: 'not legal in the format', slot: 'equipment', cardIdentifier: 'diamond-hands', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_in_format' },
  { rule: 'not legal for the hero', slot: 'mainboard', cardIdentifier: 'a-good-clean-fight-red', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_for_hero' },
  { rule: 'not legal for the hero', slot: 'equipment', cardIdentifier: 'achilles-accelerator', hero: KATSU_ADULT, format: 'Classic Constructed', code: 'card_not_for_hero' },
  { rule: 'not legal in Silver Age', slot: 'mainboard', cardIdentifier: 'amethyst-amulet-blue', hero: SILVER_AGE_HERO, format: 'Silver Age', code: 'card_not_in_format' },
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

  it.each([
    ['a regular card in Classic Constructed', 'emissary-of-tides-red', 'Classic Constructed', 3],
    ['a regular card in Blitz', 'emissary-of-tides-red', 'Blitz', 1],
    ['a Legendary card', 'amethyst-amulet-blue', 'Classic Constructed', 1],
  ] as const)('caps copies per card: %s', (_label, cardIdentifier, format, limit) => {
    const card = catalog.getCard(cardIdentifier);

    expect(getCopyLimit(card, format)).toBe(limit);
  });
});

describe('per-card legality across slots and special limits', () => {
  it('per-card checks run on every slot', () => {
    const deck: ILegalityDeck = {
      heroIdentifier: 'katsu-the-wanderer',
      cards: [
        { cardIdentifier: 'bloodsheath-skeleta', quantity: 1, slot: 'equipment' },
        { cardIdentifier: 'diamond-hands', quantity: 1, slot: 'weapon' },
        { cardIdentifier: 'arknight-shard-blue', quantity: 0, slot: 'mainboard', inventoryQuantity: 1 },
      ],
    };

    const codes = computeDeckLegality(deck, catalog, 'Classic Constructed').details.map((detail) => [
      detail.code,
      (detail.params as { cardIdentifier?: string }).cardIdentifier,
    ]);

    expect(codes).toEqual(
      expect.arrayContaining([
        ['card_banned', 'bloodsheath-skeleta'],
        ['card_not_in_format', 'diamond-hands'],
        ['card_not_for_hero', 'arknight-shard-blue'],
      ]),
    );
  });

  it('silver age legality comes from legalFormats', () => {
    const bladeDance = catalog.getCard('blade-dance');
    const amulet = catalog.getCard('amethyst-amulet-blue');

    expect(findCardLegalityViolation(bladeDance, SILVER_AGE_HERO, 'Silver Age')).toBeNull();
    expect(findCardLegalityViolation(amulet, SILVER_AGE_HERO, 'Silver Age')?.detail.code).toBe('card_not_in_format');
  });

  it.each([
    ['Classic Constructed', 1],
    ['Living Legend', 1],
    ['Blitz', 1],
    ['Silver Age', 1],
  ] as const)('legendary and living legend restricted copy limits: a Legendary card is limited to %s %i', (format, limit) => {
    const legendary = catalog.getCard('a-drop-in-the-ocean-blue');
    const hero = format === 'Classic Constructed' || format === 'Living Legend' ? KATSU_ADULT : SILVER_AGE_HERO;
    const deck: ILegalityDeck = {
      heroIdentifier: hero.cardIdentifier,
      cards: [{ cardIdentifier: legendary.cardIdentifier, quantity: 2, slot: 'mainboard' }],
    };

    const problems = computeDeckLegality(deck, catalog, format).details.filter((detail) => detail.code === 'too_many_copies');

    expect(getCopyLimit(legendary, format)).toBe(limit);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ params: { count: 2, limit, legendary: true } });
  });

  it('legendary and living legend restricted copy limits: a restricted card is 1 only in Living Legend', () => {
    const restricted = catalog.getCard('bonds-of-ancestry-red');

    expect(getCopyLimit(restricted, 'Living Legend')).toBe(1);
    expect(getCopyLimit(restricted, 'Classic Constructed')).toBe(3);

    const deck: ILegalityDeck = {
      heroIdentifier: KATSU_ADULT.cardIdentifier,
      cards: [{ cardIdentifier: restricted.cardIdentifier, quantity: 2, slot: 'mainboard' }],
    };
    const copyProblems = (format: TSupportedFormat) =>
      computeDeckLegality(deck, catalog, format).details.filter((detail) => detail.code === 'too_many_copies');

    expect(copyProblems('Living Legend')).toHaveLength(1);
    expect(copyProblems('Living Legend')[0]).toMatchObject({ params: { count: 2, limit: 1, restricted: true } });
    expect(copyProblems('Classic Constructed')).toHaveLength(0);
  });
});

describe('Legendary keyword', () => {
  it('is read by the value the catalog stores', () => {
    expect(Keyword.Legendary).toBe('Legendary');
    expect(isLegendary(catalog.getCard('a-drop-in-the-ocean-blue'))).toBe(true);
    expect(isLegendary(catalog.getCard('adrenaline-rush-red'))).toBe(false);
  });
});

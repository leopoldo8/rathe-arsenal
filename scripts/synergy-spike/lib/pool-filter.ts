import type { ICatalog, ICatalogCard, TSupportedFormat } from '../../../packages/engine/src';
import { FORMAT_RULES, Type } from '../../../packages/engine/src';
import type { IDeckFile, IPoolFile } from './types';

/**
 * The per-card tests of step 5 and step 6 of `computeDeckLegality`
 * (packages/engine/src/legality/compute.ts), copied here because the engine
 * exposes only the deck-level function, which returns `incomplete` for a deck
 * under the format minimum before it reaches those steps. If the spike passes,
 * the feature extracts the predicate into the engine instead.
 */
export function isCardInPool(
  card: ICatalogCard,
  hero: ICatalogCard,
  format: TSupportedFormat,
): boolean {
  if ((card.bannedFormats as readonly string[] | undefined)?.includes(format)) return false;
  if (!(card.legalFormats as readonly string[]).includes(format)) return false;

  const heroEnum = hero.hero as string | undefined;
  if (card.legalHeroes.length > 0 && heroEnum !== undefined) {
    const heroAllowed = (card.legalHeroes as readonly string[]).includes(heroEnum);
    const overrideAllowed = (card.legalOverrides ?? []).some(
      (o) => o.format === format && (o.heroes as readonly string[]).includes(heroEnum),
    );
    const specializationAllowed = (card.specializations as readonly string[] | undefined)?.includes(heroEnum) ?? false;
    if (!heroAllowed && !overrideAllowed && !specializationAllowed) return false;
  }

  const allowedRarities = FORMAT_RULES[format].allowedRarities;
  if (allowedRarities !== null && !allowedRarities.has(card.rarity as string)) return false;

  return true;
}

function isHeroCard(card: ICatalogCard): boolean {
  return card.types.includes(Type.Hero);
}

function isToken(card: ICatalogCard): boolean {
  return card.types.includes(Type.Token);
}

export function buildPool(deck: IDeckFile, catalog: ICatalog): IPoolFile {
  const format = deck.format as TSupportedFormat;
  const hero = catalog.getCard(deck.hero);
  const inDeck = new Set(deck.mainboard.map((e) => e.card));

  const cards = catalog.cards
    .filter((card) => isCardInPool(card, hero, format))
    .filter((card) => !isHeroCard(card) && !isToken(card) && !inDeck.has(card.cardIdentifier))
    .map((card) => card.cardIdentifier);

  return { deck: deck.deck, hero: deck.hero, format: deck.format, size: cards.length, cards };
}

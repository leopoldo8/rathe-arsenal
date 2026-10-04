/**
 * Per-card legality rules shared by `computeDeckLegality` and the alternatives
 * search: ban, format membership, hero scope, Silver Age rarity and the copy
 * limit. Each rule reads one card against the deck's hero and format, with no
 * knowledge of the slot the card sits in.
 */

import type { ICatalogCard } from '../catalog/types';
import { Keyword } from '../catalog/types';
import { FORMAT_RULES } from './rules';
import type { TLegalityReasonDetail, TSupportedFormat } from './types';

/** A rule a card breaks: the sentence the deck verdict shows and its localizable detail. */
export interface ICardLegalityViolation {
  readonly reason: string;
  readonly detail: TLegalityReasonDetail;
}

/**
 * Ban, format membership and hero scope, in that order. Returns the first
 * rule the card breaks, or null.
 */
export function findCardScopeViolation(
  card: ICatalogCard,
  heroCard: ICatalogCard,
  format: TSupportedFormat,
): ICardLegalityViolation | null {
  if (card.bannedFormats && (card.bannedFormats as readonly string[]).includes(format)) {
    return {
      reason: `"${card.name}" is banned in ${format}.`,
      detail: { code: 'card_banned', params: { card: card.name, format } },
    };
  }

  if (!(card.legalFormats as readonly string[]).includes(format)) {
    return {
      reason: `"${card.name}" is not legal in ${format}.`,
      detail: { code: 'card_not_in_format', params: { card: card.name, format } },
    };
  }

  // The `hero` field on a Hero-type card is the Hero enum value (e.g. "Dorinthea"),
  // which is what legalHeroes, legalOverrides.heroes, and specializations contain.
  const heroHeroEnum: string | undefined = heroCard.hero as string | undefined;

  // A card with an empty legalHeroes array is usable by all heroes.
  // When legalHeroes is non-empty, the deck's hero must appear in it
  // OR the card must have a matching legalOverride OR a matching specialization.
  if (card.legalHeroes.length > 0 && heroHeroEnum !== undefined) {
    const heroAllowed = (card.legalHeroes as readonly string[]).includes(heroHeroEnum);

    // legalOverrides: per-format additional hero scope.
    const overrideAllowed =
      card.legalOverrides != null &&
      card.legalOverrides.some(
        (o) => o.format === format && (o.heroes as readonly string[]).includes(heroHeroEnum),
      );

    // specializations: the card has Keyword.Specialization; only the named hero(es) can run it.
    const specializationAllowed =
      card.specializations != null &&
      (card.specializations as readonly string[]).includes(heroHeroEnum);

    if (!heroAllowed && !overrideAllowed && !specializationAllowed) {
      return {
        reason: `"${card.name}" is not legal with hero "${heroCard.name}".`,
        detail: { code: 'card_not_for_hero', params: { card: card.name, hero: heroCard.name } },
      };
    }
  }

  return null;
}

/** The Silver Age rarity whitelist; null when the format has none or the card passes. */
export function findCardRarityViolation(
  card: ICatalogCard,
  format: TSupportedFormat,
): ICardLegalityViolation | null {
  const { allowedRarities } = FORMAT_RULES[format];
  if (allowedRarities === null || allowedRarities.has(card.rarity as string)) return null;

  const allowed = [...allowedRarities].filter((r) => r !== 'Token').join(', ');
  return {
    reason: `"${card.name}" (${card.rarity}) is not allowed in ${format}, which only permits ${allowed}.`,
    detail: {
      code: 'rarity_not_allowed',
      params: { card: card.name, rarity: card.rarity as string, format, allowed },
    },
  };
}

/** Every per-card rule: ban, format, hero scope, then Silver Age rarity. */
export function findCardLegalityViolation(
  card: ICatalogCard,
  heroCard: ICatalogCard,
  format: TSupportedFormat,
): ICardLegalityViolation | null {
  return findCardScopeViolation(card, heroCard, format) ?? findCardRarityViolation(card, format);
}

/** Copies of one card a deck may hold: 1 for a Legendary card, the format's limit otherwise. */
export function getCopyLimit(card: ICatalogCard, format: TSupportedFormat): number {
  const isLegendary = (card.keywords as readonly string[]).includes(Keyword.Legendary);
  return isLegendary ? 1 : FORMAT_RULES[format].maxCopies;
}

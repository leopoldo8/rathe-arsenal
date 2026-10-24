/**
 * Per-card legality rules shared by `computeDeckLegality` and the alternatives
 * search: ban, format membership, hero scope and the copy limit. Each rule
 * reads one card against the deck's hero and format, with no knowledge of the
 * slot the card sits in.
 */

import { FORMAT_RULES } from './rules';
import type { ILegalityCard, TLegalityReasonDetail, TSupportedFormat } from './types';

/** A rule a card breaks: the sentence the deck verdict shows and its localizable detail. */
export interface ICardLegalityViolation {
  readonly reason: string;
  readonly detail: TLegalityReasonDetail;
}

/**
 * Ban, format membership and hero scope, in that order. Returns the first
 * rule the card breaks, or null. `legalFormats` already encodes Silver Age's
 * rule that only cards once printed as common, rare or basic are legal.
 */
export function findCardLegalityViolation(
  card: ILegalityCard,
  heroCard: ILegalityCard,
  format: string,
): ICardLegalityViolation | null {
  const { name, cardIdentifier } = card;

  if (card.bannedFormats?.includes(format)) {
    return {
      reason: `"${name}" is banned in ${format}.`,
      detail: { code: 'card_banned', params: { card: name, cardIdentifier, format } },
    };
  }

  if (!card.legalFormats.includes(format)) {
    return {
      reason: `"${name}" is not legal in ${format}.`,
      detail: { code: 'card_not_in_format', params: { card: name, cardIdentifier, format } },
    };
  }

  // The `hero` field on a Hero-type card is the Hero enum value (e.g. "Dorinthea"),
  // which is what legalHeroes, legalOverrides.heroes, and specializations contain.
  const heroHeroEnum = heroCard.hero;

  // A card with an empty legalHeroes array is usable by all heroes.
  // When legalHeroes is non-empty, the deck's hero must appear in it
  // OR the card must have a matching legalOverride OR a matching specialization.
  if (card.legalHeroes.length > 0 && heroHeroEnum !== undefined) {
    const heroAllowed = card.legalHeroes.includes(heroHeroEnum);

    const overrideAllowed =
      card.legalOverrides != null &&
      card.legalOverrides.some((o) => o.format === format && o.heroes.includes(heroHeroEnum));

    const specializationAllowed = card.specializations?.includes(heroHeroEnum) ?? false;

    if (!heroAllowed && !overrideAllowed && !specializationAllowed) {
      return {
        reason: `"${name}" is not legal with hero "${heroCard.name}".`,
        detail: { code: 'card_not_for_hero', params: { card: name, cardIdentifier, hero: heroCard.name } },
      };
    }
  }

  return null;
}

/** Whether the format has its own, smaller limit for this card (restricted list). */
export function isRestrictedIn(card: ILegalityCard, format: string): boolean {
  return card.restrictedFormats?.includes(format) ?? false;
}

const LEGENDARY_KEYWORD = 'Legendary';

export function isLegendary(card: ILegalityCard): boolean {
  return card.keywords.includes(LEGENDARY_KEYWORD);
}

/**
 * Copies of one card a deck may hold: 1 for a Legendary card and for a card
 * restricted in the format, the format's limit otherwise. A format with no
 * rules has no limit to check.
 */
export function getCopyLimit(card: ILegalityCard, format: string): number {
  if (isLegendary(card) || isRestrictedIn(card, format)) return 1;
  return FORMAT_RULES[format as TSupportedFormat]?.maxCopies ?? Number.POSITIVE_INFINITY;
}

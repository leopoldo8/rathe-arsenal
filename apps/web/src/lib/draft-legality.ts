import {
  computeDeckLegality,
  FORMAT_RULES,
  getCopyLimit,
  type IDeckLegalityResult,
  type ILegalityCard,
} from '@rathe-arsenal/engine/legality';
import type { ICompositionDraft, IDraftCard } from '../hooks/useCompositionDraft';
import type { IHeroListItem } from '../api/catalog';
import type { IDeckLegality } from '../api/decks';
import type { ICascadeCheckResult, TCascadeReason } from '../hooks/useCascadeCheck';

const LEGENDARY_KEYWORD = 'Legendary';

function toLegalityCard(card: IDraftCard, format: string): ILegalityCard {
  const factsKnown = card.legalFormats.length > 0;
  return {
    cardIdentifier: card.cardIdentifier,
    name: card.name,
    pitch: card.pitch,
    keywords: card.legendary === true ? [LEGENDARY_KEYWORD] : [],
    legalFormats: factsKnown ? card.legalFormats : [format],
    bannedFormats: card.bannedFormats,
    restrictedFormats: card.restrictedFormats ?? [],
    legalHeroes: card.legalHeroes,
    legalOverrides: card.legalOverrides ?? [],
    specializations: card.specializations ?? [],
    young: false,
  };
}

function toHeroCard(hero: IHeroListItem): ILegalityCard {
  return {
    cardIdentifier: hero.cardIdentifier,
    name: hero.name,
    pitch: null,
    keywords: [],
    legalFormats: hero.legalFormats,
    legalHeroes: [],
    ...(hero.hero === null ? {} : { hero: hero.hero }),
    young: hero.young,
  };
}

/**
 * The verdict of a draft, computed with the engine's own rules. Null while the draft's hero is
 * still loading, because a verdict without the hero would call every hero-scoped card illegal.
 */
export function computeDraftLegality(
  draft: ICompositionDraft,
  hero: IHeroListItem | null,
): IDeckLegalityResult | null {
  if (draft.heroIdentifier !== null && hero === null) return null;

  const cards = new Map<string, ILegalityCard>(
    draft.cards.map((card) => [card.cardIdentifier, toLegalityCard(card, draft.format)]),
  );
  if (hero !== null) cards.set(hero.cardIdentifier, toHeroCard(hero));

  return computeDeckLegality(
    {
      heroIdentifier: draft.heroIdentifier,
      cards: draft.cards.map((card) => ({
        cardIdentifier: card.cardIdentifier,
        quantity: card.quantity,
        slot: card.slot === 'other' ? 'mainboard' : card.slot,
      })),
    },
    { indices: { byIdentifier: cards } },
    draft.format,
  );
}

export type TCopyLimitKind = 'format' | 'legendary' | 'restricted';

export interface ICopyInfo {
  readonly total: number;
  readonly limit: number;
  readonly kind: TCopyLimitKind;
}

/**
 * How many copies of a draft card the deck holds across every row and slot (a card is its name and
 * pitch) against the limit that applies to it. Null for a format the engine has no rules for.
 */
export function copyInfoFor(draft: ICompositionDraft, card: IDraftCard): ICopyInfo | null {
  if (!Object.prototype.hasOwnProperty.call(FORMAT_RULES, draft.format)) return null;

  const total = draft.cards
    .filter((entry) => entry.slot !== 'hero' && entry.name === card.name && entry.pitch === card.pitch)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const restricted = card.restrictedFormats?.includes(draft.format) ?? false;
  const kind: TCopyLimitKind = card.legendary === true ? 'legendary' : restricted ? 'restricted' : 'format';
  return { total, limit: getCopyLimit(toLegalityCard(card, draft.format), draft.format), kind };
}

const CASCADE_REASON_BY_CODE: Readonly<Record<string, TCascadeReason>> = {
  card_banned: 'banned',
  card_not_in_format: 'format',
  card_not_for_hero: 'hero',
};

/** The cards the engine refuses in the draft, in the shape the "Cartas ilegais" panel reads. */
export function cascadeFromLegality(result: IDeckLegalityResult | null): ICascadeCheckResult {
  const reasons = new Map<string, TCascadeReason>();
  for (const detail of result?.details ?? []) {
    const reason = CASCADE_REASON_BY_CODE[detail.code];
    const { cardIdentifier } = detail.params as { readonly cardIdentifier?: string };
    if (reason !== undefined && cardIdentifier !== undefined) reasons.set(cardIdentifier, reason);
  }
  return { illegalCardIds: new Set(reasons.keys()), count: reasons.size, reasons };
}

export function toDeckLegality(result: IDeckLegalityResult): IDeckLegality {
  return { category: result.category, reasons: result.reasons, details: result.details };
}


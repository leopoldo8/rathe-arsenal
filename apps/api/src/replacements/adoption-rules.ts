import { findCardLegalityViolation, getCopyLimit, ICatalogCard, TSupportedFormat } from '@rathe-arsenal/engine';
import { slotForCard } from '../recommendations/recommendation-prompt';
import { NON_REPLACEABLE_SLOTS } from './alternatives.service';
import { TReplacementErrorCode } from './replacement-errors';

export interface IAdoptionInput {
  readonly recommended: ICatalogCard;
  readonly cut: ICatalogCard;
  readonly cutSlot: string;
  readonly heroCard: ICatalogCard | null;
  readonly format: TSupportedFormat;
  readonly deckCards: readonly { readonly cardIdentifier: string; readonly slot: string; readonly quantity: number }[];
}

export type TAdoptionDecision =
  | { readonly kind: 'move'; readonly quantity: number }
  | { readonly kind: 'refuse'; readonly code: Extract<TReplacementErrorCode, 'REPLACEMENT_ILLEGAL' | 'NOTHING_TO_REPLACE'> };

const ILLEGAL = { kind: 'refuse', code: 'REPLACEMENT_ILLEGAL' } as const;

/** Every copy of the cut card in its slot moves, capped by the recommended card's copy limit across the deck. */
export function decideAdoption({ recommended, cut, cutSlot, heroCard, format, deckCards }: IAdoptionInput): TAdoptionDecision {
  if (
    NON_REPLACEABLE_SLOTS.has(cutSlot) ||
    recommended.cardIdentifier === cut.cardIdentifier ||
    slotForCard(recommended) !== cutSlot
  ) {
    return ILLEGAL;
  }
  const copiesOf = (cardIdentifier: string, slot?: string): number =>
    deckCards
      .filter((row) => row.cardIdentifier === cardIdentifier && (slot === undefined || row.slot === slot))
      .reduce((sum, row) => sum + row.quantity, 0);

  const cutCopies = copiesOf(cut.cardIdentifier, cutSlot);
  if (cutCopies === 0) return { kind: 'refuse', code: 'NOTHING_TO_REPLACE' };
  if (heroCard === null || findCardLegalityViolation(recommended, heroCard, format) !== null) return ILLEGAL;

  const quantity = Math.min(cutCopies, getCopyLimit(recommended, format) - copiesOf(recommended.cardIdentifier));
  return quantity > 0 ? { kind: 'move', quantity } : ILLEGAL;
}

import { findCardLegalityViolation, getCopyLimit, ICatalogCard, TSupportedFormat } from '@rathe-arsenal/engine';
import { slotForCard } from '../recommendations/recommendation-prompt';
import { NON_REPLACEABLE_SLOTS } from './alternatives.service';
import { TReplacementSide } from '../database/entities/card-replacement.entity';
import { TReplacementErrorCode } from './replacement-errors';

export interface IAdoptionInput {
  readonly recommended: ICatalogCard;
  readonly cut: ICatalogCard;
  readonly cutSlot: string;
  readonly heroCard: ICatalogCard | null;
  readonly format: TSupportedFormat;
  readonly deckCards: readonly {
    readonly cardIdentifier: string;
    readonly slot: string;
    readonly quantity: number;
    readonly inventoryQuantity?: number | undefined;
  }[];
  /** Copies to move; omitted, every copy of the cut card on `side`. */
  readonly quantity?: number | undefined;
  /** Where the copies come from; omitted, the deck. */
  readonly side?: TReplacementSide | undefined;
}

export type TAdoptionDecision =
  | { readonly kind: 'move'; readonly quantity: number }
  | { readonly kind: 'refuse'; readonly code: Extract<TReplacementErrorCode, 'REPLACEMENT_ILLEGAL' | 'NOTHING_TO_REPLACE'> };

const ILLEGAL = { kind: 'refuse', code: 'REPLACEMENT_ILLEGAL' } as const;

/**
 * The copies of the cut card on one side move, capped by the recommended card's copy limit across deck and inventory.
 * With a `quantity`, exactly that many move or the pick is refused.
 */
export function decideAdoption({ recommended, cut, cutSlot, heroCard, format, deckCards, quantity: requested, side = 'deck' }: IAdoptionInput): TAdoptionDecision {
  if (
    NON_REPLACEABLE_SLOTS.has(cutSlot) ||
    recommended.cardIdentifier === cut.cardIdentifier ||
    slotForCard(recommended) !== cutSlot
  ) {
    return ILLEGAL;
  }
  const copiesOf = (cardIdentifier: string, slot?: string, only?: TReplacementSide): number =>
    deckCards
      .filter((row) => row.cardIdentifier === cardIdentifier && (slot === undefined || row.slot === slot))
      .reduce((sum, row) => {
        const inventory = row.inventoryQuantity ?? 0;
        if (only === 'deck') return sum + row.quantity;
        if (only === 'inventory') return sum + inventory;
        return sum + row.quantity + inventory;
      }, 0);

  const cutCopies = copiesOf(cut.cardIdentifier, cutSlot, side);
  if (cutCopies === 0) return { kind: 'refuse', code: 'NOTHING_TO_REPLACE' };
  if (heroCard === null || findCardLegalityViolation(recommended, heroCard, format) !== null) return ILLEGAL;

  const room = getCopyLimit(recommended, format) - copiesOf(recommended.cardIdentifier);
  if (requested !== undefined) return requested <= cutCopies && requested <= room ? { kind: 'move', quantity: requested } : ILLEGAL;
  const quantity = Math.min(cutCopies, room);
  return quantity > 0 ? { kind: 'move', quantity } : ILLEGAL;
}

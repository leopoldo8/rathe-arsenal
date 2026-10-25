import type { ISharedCard, TStoreState } from '../../api/shared-decks';

export interface IGiveRow {
  readonly card: ISharedCard;
  /** Copies the store cannot supply of this card: the ones people are asked for. */
  readonly copies: number;
  /** What the signed-in visitor can offer: what they own, at most the copies asked; 0 when unknown. */
  readonly offerable: number;
}

export function stateOf(card: ISharedCard): TStoreState {
  return card.state ?? 'not_on_site';
}

function unsuppliedCopies(card: ISharedCard): number {
  const state = stateOf(card);
  if (state === 'store_lacks' || state === 'not_on_site') return card.quantity;
  if (state === 'priced') return Math.max(0, card.quantity - (card.availableCopies ?? 0));
  return 0;
}

/**
 * The first section: every card the store cannot supply fully, with the copies it cannot. Cards the visitor owns come
 * first, each group keeping the order the API gave.
 */
export function giveRows(cards: readonly ISharedCard[]): readonly IGiveRow[] {
  const rows = cards
    .map((card): IGiveRow => {
      const copies = unsuppliedCopies(card);
      return { card, copies, offerable: Math.min(card.owned ?? 0, copies) };
    })
    .filter((row) => row.copies > 0);
  return [...rows.filter((row) => row.offerable > 0), ...rows.filter((row) => row.offerable === 0)];
}

export interface IStoreRows {
  /** Cards the store has priced: bought from the store. */
  readonly priced: readonly ISharedCard[];
  /** Cards the store has but whose price is not known yet; they stay outside the store's total. */
  readonly soon: readonly ISharedCard[];
}

export function storeRows(cards: readonly ISharedCard[]): IStoreRows {
  return {
    priced: cards.filter((card) => stateOf(card) === 'priced' && (card.availableCopies ?? 0) > 0),
    soon: cards.filter((card) => stateOf(card) === 'looking_up' || stateOf(card) === 'no_price'),
  };
}

/** Copies of a card that sit in the inventory when the whole line is asked for; null when none or when only part is. */
export function inventorySplit(card: ISharedCard, copies: number): { deck: number; inventory: number } | null {
  const inventory = card.inventoryQuantity ?? 0;
  if (inventory === 0 || copies !== card.quantity) return null;
  return { deck: card.quantity - inventory, inventory };
}

import { catalog, ICatalogCard, Type } from '@rathe-arsenal/engine';
import { ICountedCard } from '../common/deck-counts';
import { slotOf } from './proposal-validation';

export interface IDeckRow {
  readonly cardIdentifier: string;
  readonly quantity: number;
  /** Copies carried in the inventory beside `quantity`; they count in the card pool and the copy limit. */
  readonly inventoryQuantity?: number;
  readonly slot?: string;
}

export interface ISlottedCard extends ICountedCard {
  readonly slot: string;
}

export function findCard(cardIdentifier: string): ICatalogCard | null {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return null;
  }
}

export function typeLine(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ');
}

export function slotFor(row: IDeckRow, card: ICatalogCard | null): string {
  if (row.slot) return row.slot;
  if (card?.types.includes(Type.Hero)) return 'hero';
  return card ? slotOf(card) : 'mainboard';
}

export function slottedCards(rows: readonly IDeckRow[]): ISlottedCard[] {
  return rows.flatMap((row) => {
    const card = findCard(row.cardIdentifier);
    return card ? [{ card, quantity: row.quantity, slot: slotFor(row, card) }] : [];
  });
}

export function mainboardCards(rows: readonly IDeckRow[]): ISlottedCard[] {
  return slottedCards(rows).filter((entry) => entry.slot === 'mainboard');
}

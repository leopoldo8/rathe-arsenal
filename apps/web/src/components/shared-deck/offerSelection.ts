import type { IOfferItem } from './OfferButton';
import type { IGiveRow } from './sharedMissingModel';

/** Copies the visitor says they have, by card line. A line that is absent is not selected. */
export type TOfferSelection = Readonly<Record<string, number>>;

export const EMPTY_SELECTION: TOfferSelection = {};

export function giveRowKey(row: IGiveRow): string {
  return `${row.card.cardIdentifier}::${row.card.slot}`;
}

/** Copies a card starts at when it is ticked: what the visitor owns of it, or every copy asked when that is not known. */
export function defaultCopies(row: IGiveRow): number {
  return row.offerable > 0 ? row.offerable : row.copies;
}

export function toggleRow(selection: TOfferSelection, row: IGiveRow): TOfferSelection {
  const key = giveRowKey(row);
  if (selection[key] !== undefined) {
    return Object.fromEntries(Object.entries(selection).filter(([entryKey]) => entryKey !== key));
  }
  return { ...selection, [key]: defaultCopies(row) };
}

/** Sets the copies of a selected card, kept between 1 and the copies asked. */
export function setRowCopies(selection: TOfferSelection, row: IGiveRow, copies: number): TOfferSelection {
  const key = giveRowKey(row);
  if (selection[key] === undefined) return selection;
  return { ...selection, [key]: Math.min(row.copies, Math.max(1, copies)) };
}

/** The selected cards in the order of the list, with their copies. */
export function offerItems(rows: readonly IGiveRow[], selection: TOfferSelection): readonly IOfferItem[] {
  return rows.flatMap((row) => {
    const count = selection[giveRowKey(row)];
    return count === undefined ? [] : [{ name: row.card.name, pitch: row.card.pitch, count }];
  });
}

export function totalCopies(items: readonly IOfferItem[]): number {
  return items.reduce((sum, item) => sum + item.count, 0);
}

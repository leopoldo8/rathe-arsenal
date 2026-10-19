import { IBreakdownEntry, ICatalogCard } from '@rathe-arsenal/engine';
import { ISharedCard } from './dtos/shared-deck.dto';

export function toSharedCardFromBreakdown(entry: IBreakdownEntry): ISharedCard {
  return {
    cardIdentifier: entry.cardIdentifier,
    name: entry.name,
    pitch: entry.pitch,
    type: entry.type,
    slot: entry.slot,
    quantity: entry.quantity,
    imageUrl: entry.imageUrl
      ? {
          small: entry.imageUrl.small,
          large: entry.imageUrl.large,
          sources: entry.imageUrl.sources.map((source) => ({ ...source })),
        }
      : null,
  };
}

export function sumQuantities(items: readonly { readonly quantity: number }[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export interface IDeckCardRow {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
}

export type TCatalogLookup = (cardIdentifier: string) => ICatalogCard | undefined;

export function toSharedCardFromRow(row: IDeckCardRow, lookup: TCatalogLookup): ISharedCard {
  const card = lookup(row.cardIdentifier);
  const pitch = card?.pitch;
  return {
    cardIdentifier: row.cardIdentifier,
    name: card?.name ?? row.cardIdentifier,
    pitch: pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null,
    type: card?.types[0] ?? 'unknown',
    slot: row.slot,
    quantity: row.quantity,
    imageUrl: card?.imageUrl
      ? {
          small: card.imageUrl.small,
          large: card.imageUrl.large,
          sources: card.imageUrl.sources.map((source) => ({ ...source })),
        }
      : null,
  };
}

const HERO_SLOT = 'hero';

/** Imported decks keep the hero as a deck_card row; scratch decks only carry `heroIdentifier`. */
export function resolveHeroCard(
  rows: readonly IDeckCardRow[],
  heroIdentifier: string | null,
  lookup: TCatalogLookup,
): ISharedCard | null {
  const heroRow = rows.find((row) => row.slot === HERO_SLOT);
  if (heroRow) return toSharedCardFromRow(heroRow, lookup);
  if (!heroIdentifier || !lookup(heroIdentifier)) return null;
  return toSharedCardFromRow({ cardIdentifier: heroIdentifier, quantity: 1, slot: HERO_SLOT }, lookup);
}

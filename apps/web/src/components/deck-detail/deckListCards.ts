import type { IBreakdown, IBreakdownEntry } from '../../api/deck-detail';
import type { ISharedCard } from '../../api/shared-decks';
import { entryKey } from './deckDetailModel';

/** One deck line as the list views and the copied text read it: its deck copies and its inventory copies apart. */
export interface IListCard {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly cost: number | null;
  readonly type: string;
  /** Copies in the starting deck. */
  readonly quantity: number;
  /** Copies carried outside the starting deck. */
  readonly inventoryQuantity: number;
  /** Deck copies the collection does not cover. */
  readonly missing: number;
  /** Inventory copies the collection does not cover. */
  readonly missingInventory: number;
}

export type TListSectionId = 'hero' | 'weapon' | 'equipment' | 'deck' | 'inventory';

export interface IListSectionLine {
  readonly card: IListCard;
  /** The copies this line counts: deck copies, or inventory copies in the inventory section. */
  readonly quantity: number;
  readonly missing: number;
}

export interface IListSection {
  readonly id: TListSectionId;
  readonly total: number;
  readonly lines: readonly IListSectionLine[];
}

const LOADOUT_SECTIONS: readonly TListSectionId[] = ['hero', 'weapon', 'equipment'];

function sectionOfSlot(slot: string): TListSectionId {
  return (LOADOUT_SECTIONS as readonly string[]).includes(slot) ? (slot as TListSectionId) : 'deck';
}

function inventoryOf(entry: IBreakdownEntry): number {
  return entry.inventoryQuantity ?? 0;
}

/**
 * The deck's lines in the order the readiness result lists them: every owned entry and every entry
 * still missing, merged per card and slot so a partly owned card is one line.
 */
export function buildListCards(
  breakdown: IBreakdown,
  openMissing: readonly IBreakdownEntry[],
  heroFallbackName: string | null = null,
): readonly IListCard[] {
  const missingDeck = new Map<string, number>();
  const missingInventory = new Map<string, number>();
  for (const entry of openMissing) {
    const key = entryKey(entry);
    missingDeck.set(key, (missingDeck.get(key) ?? 0) + entry.quantity - inventoryOf(entry));
    missingInventory.set(key, (missingInventory.get(key) ?? 0) + inventoryOf(entry));
  }

  const merged = new Map<string, IListCard>();
  for (const entry of [...breakdown.exact, ...(breakdown.notOwned ?? breakdown.missing)]) {
    const key = entryKey(entry);
    const known = merged.get(key);
    merged.set(key, {
      cardIdentifier: entry.cardIdentifier,
      slot: entry.slot,
      name: entry.name,
      pitch: entry.pitch,
      cost: entry.cost,
      type: entry.type,
      quantity: (known?.quantity ?? 0) + entry.quantity - inventoryOf(entry),
      inventoryQuantity: (known?.inventoryQuantity ?? 0) + inventoryOf(entry),
      missing: missingDeck.get(key) ?? 0,
      missingInventory: missingInventory.get(key) ?? 0,
    });
  }

  const cards = [...merged.values()];
  if (heroFallbackName === null || cards.some((card) => card.slot === 'hero')) return cards;
  // A scratch deck keeps its hero in the deck row only after the first save: the name still belongs on the list.
  return [
    { cardIdentifier: 'hero', slot: 'hero', name: heroFallbackName, pitch: null, cost: null, type: 'Hero', quantity: 1, inventoryQuantity: 0, missing: 0, missingInventory: 0 },
    ...cards,
  ];
}

/** The lines of a shared deck, which carries no cost and no ownership of the visitor. */
export function listCardsFromShared(cards: readonly ISharedCard[]): readonly IListCard[] {
  return cards.map((card) => ({
    cardIdentifier: card.cardIdentifier,
    slot: card.slot,
    name: card.name,
    pitch: card.pitch,
    cost: null,
    type: card.type,
    quantity: card.quantity,
    inventoryQuantity: card.inventoryQuantity ?? 0,
    missing: 0,
    missingInventory: 0,
  }));
}

function sectionOf(id: TListSectionId, lines: readonly IListSectionLine[]): IListSection {
  return { id, total: lines.reduce((sum, line) => sum + line.quantity, 0), lines };
}

/** Hero, weapon, equipment, deck, inventory, in that order, each with its lines in the order given; empty sections are left out. */
export function buildSections(cards: readonly IListCard[]): readonly IListSection[] {
  const onDeckSide = cards
    .filter((card) => card.quantity > 0)
    .map((card): IListSectionLine & { readonly section: TListSectionId } => ({
      card,
      quantity: card.quantity,
      missing: card.missing,
      section: sectionOfSlot(card.slot),
    }));
  const inventory = cards
    .filter((card) => card.inventoryQuantity > 0)
    .map((card): IListSectionLine => ({ card, quantity: card.inventoryQuantity, missing: card.missingInventory }));

  const ordered: readonly TListSectionId[] = ['hero', 'weapon', 'equipment', 'deck'];
  return [
    ...ordered.map((id) => sectionOf(id, onDeckSide.filter((line) => line.section === id))),
    sectionOf('inventory', inventory),
  ].filter((section) => section.lines.length > 0);
}

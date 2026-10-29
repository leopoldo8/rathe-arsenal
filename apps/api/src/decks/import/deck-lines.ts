import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';

export interface IDeckLine {
  readonly cardIdentifier: string;
  readonly slot: 'mainboard' | 'equipment' | 'weapon' | 'hero';
  readonly quantity: number;
  readonly inventoryQuantity: number;
}

/**
 * The deck lines of an imported deck: one per card and slot, with Fabrary's "Inventory" copies
 * (`sideboardQuantity`) stored as the line's inventory quantity (door 3). A card with no deck copy
 * and some inventory copies becomes a line with quantity 0. The hero is one line of its own.
 */
export function buildDeckLines(deck: IDeckImportDto): IDeckLine[] {
  const lines = new Map<string, IDeckLine>();
  const lineOf = (entry: { cardIdentifier: string; slot: IDeckLine['slot'] }): IDeckLine =>
    lines.get(`${entry.cardIdentifier}::${entry.slot}`) ?? {
      cardIdentifier: entry.cardIdentifier,
      slot: entry.slot,
      quantity: 0,
      inventoryQuantity: 0,
    };
  const store = (line: IDeckLine): void => {
    lines.set(`${line.cardIdentifier}::${line.slot}`, line);
  };

  for (const entry of [...deck.mainboard, ...deck.equipment, ...deck.weapons]) {
    const line = lineOf(entry);
    store({ ...line, quantity: line.quantity + entry.quantity });
  }
  for (const entry of deck.inventory) {
    const line = lineOf(entry);
    store({ ...line, inventoryQuantity: line.inventoryQuantity + entry.quantity });
  }
  const hero = lineOf({ cardIdentifier: deck.hero.cardIdentifier, slot: 'hero' });
  store({ ...hero, quantity: hero.quantity + 1 });

  return [...lines.values()];
}

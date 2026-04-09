import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';

/**
 * Aggregates card quantities across multiple decks using max-wins semantics.
 * For each card identifier, the result contains the maximum quantity seen
 * across all input decks (not the sum).
 */
export function aggregateInventory(
  decks: readonly IDeckImportDto[],
): Map<string, number> {
  const inventory = new Map<string, number>();

  for (const deck of decks) {
    const allEntries = [
      ...deck.mainboard,
      ...deck.equipment,
      ...deck.weapons,
      { cardIdentifier: deck.hero.cardIdentifier, quantity: 1, slot: 'hero' as const },
    ];

    for (const entry of allEntries) {
      const current = inventory.get(entry.cardIdentifier) ?? 0;
      inventory.set(entry.cardIdentifier, Math.max(current, entry.quantity));
    }
  }

  return inventory;
}

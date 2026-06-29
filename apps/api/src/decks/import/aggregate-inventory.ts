import { IDeckImportDto } from '../../fabrary/dtos/deck-import.dto';

/**
 * Aggregates card quantities across multiple decks to seed a collection.
 *
 * Within a single deck, the copies the owner holds of a card are the
 * played copies (mainboard + equipment + weapons + hero) PLUS the copies
 * kept in the deck's "Inventory" section, so those are summed per card.
 * Across decks, max-wins semantics apply (decks share cards, so the owner
 * needs the largest single-deck requirement, not the sum across decks).
 *
 * The "Maybe" section is never fetched, so it never contributes here.
 */
export function aggregateInventory(
  decks: readonly IDeckImportDto[],
): Map<string, number> {
  const inventory = new Map<string, number>();

  for (const deck of decks) {
    const perDeck = new Map<string, number>();
    const addCopies = (cardIdentifier: string, quantity: number): void => {
      perDeck.set(cardIdentifier, (perDeck.get(cardIdentifier) ?? 0) + quantity);
    };

    for (const entry of deck.mainboard) addCopies(entry.cardIdentifier, entry.quantity);
    for (const entry of deck.equipment) addCopies(entry.cardIdentifier, entry.quantity);
    for (const entry of deck.weapons) addCopies(entry.cardIdentifier, entry.quantity);
    for (const entry of deck.inventory) addCopies(entry.cardIdentifier, entry.quantity);
    addCopies(deck.hero.cardIdentifier, 1);

    for (const [cardIdentifier, quantity] of perDeck) {
      const current = inventory.get(cardIdentifier) ?? 0;
      inventory.set(cardIdentifier, Math.max(current, quantity));
    }
  }

  return inventory;
}

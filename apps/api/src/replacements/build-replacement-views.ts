import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { IDeckReplacement } from '../decks/dtos/tracked-deck-detail.response.dto';

/**
 * The active replacements as the deck detail lists them. `originalOwned` is
 * derived from the collection on every read and never stored: it holds when the
 * owner's free copies of the original, owned across active sources minus the
 * copies already in this deck in any slot, cover the replaced quantity.
 */
export function buildReplacementViews(
  activeReplacements: readonly CardReplacementEntity[],
  owned: ReadonlyMap<string, number>,
  deckCards: readonly { readonly cardIdentifier: string; readonly quantity: number }[],
  resolveName: (cardIdentifier: string) => string,
): readonly IDeckReplacement[] {
  const copiesInDeck = new Map<string, number>();
  for (const card of deckCards) {
    copiesInDeck.set(card.cardIdentifier, (copiesInDeck.get(card.cardIdentifier) ?? 0) + card.quantity);
  }

  return activeReplacements.map((replacement) => {
    const freeCopies =
      (owned.get(replacement.originalCardIdentifier) ?? 0) -
      (copiesInDeck.get(replacement.originalCardIdentifier) ?? 0);
    return {
      id: replacement.id,
      slot: replacement.slot,
      originalCardIdentifier: replacement.originalCardIdentifier,
      originalName: resolveName(replacement.originalCardIdentifier),
      replacementCardIdentifier: replacement.replacementCardIdentifier,
      quantity: replacement.quantity,
      originalOwned: freeCopies >= replacement.quantity,
    };
  });
}

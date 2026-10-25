import {
  findCardLegalityViolation,
  getCopyLimit,
  IBreakdownEntry,
  ICatalogCard,
  TSupportedFormat,
} from '@rathe-arsenal/engine';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';
import { computeNeededOnSide } from './compute-needed';

export interface ISuggestedUse {
  readonly slot: string;
  readonly original: string;
  readonly replacement: string;
  readonly quantity: number;
}

export interface ISuggestedUsesPlan {
  readonly uses: readonly ISuggestedUse[];
  readonly skipped: number;
}

export interface ISuggestedUsesInput {
  readonly notOwned: readonly Pick<IBreakdownEntry, 'cardIdentifier' | 'slot' | 'quantity' | 'inventoryQuantity'>[];
  readonly substituted: readonly {
    readonly original: Pick<IBreakdownEntry, 'cardIdentifier' | 'slot'>;
    readonly match: { readonly substitute: ICatalogCard };
  }[];
  readonly activeReplacements: readonly CardReplacementEntity[];
  readonly deckCards: readonly { readonly cardIdentifier: string; readonly quantity: number }[];
  readonly owned: ReadonlyMap<string, number>;
  readonly heroCard: ICatalogCard | null;
  readonly format: TSupportedFormat;
}

/**
 * One use per missing (card, slot) with a suggestion, in the engine's order. A use moves what a pick
 * moves, so the copies an earlier use added count against the copy limit and the free copies of a later one.
 */
export function planSuggestedUses(input: ISuggestedUsesInput): ISuggestedUsesPlan {
  const deckCopies = new Map<string, number>();
  for (const row of input.deckCards) {
    deckCopies.set(row.cardIdentifier, (deckCopies.get(row.cardIdentifier) ?? 0) + row.quantity);
  }

  const suggestions = new Map<string, { slot: string; original: string; substitute: ICatalogCard }>();
  for (const entry of input.substituted) {
    const key = `${entry.original.cardIdentifier}::${entry.original.slot}`;
    if (!suggestions.has(key)) {
      suggestions.set(key, {
        slot: entry.original.slot,
        original: entry.original.cardIdentifier,
        substitute: entry.match.substitute,
      });
    }
  }

  const uses: ISuggestedUse[] = [];
  let skipped = 0;
  for (const { slot, original, substitute } of suggestions.values()) {
    const quantity = computeNeededOnSide(input.notOwned, input.activeReplacements, original, slot, 'deck');
    if (quantity === 0) continue;

    const inDeck = deckCopies.get(substitute.cardIdentifier) ?? 0;
    const legal =
      input.heroCard !== null &&
      findCardLegalityViolation(substitute, input.heroCard, input.format) === null &&
      inDeck + quantity <= getCopyLimit(substitute, input.format);
    const hasFreeCopy = (input.owned.get(substitute.cardIdentifier) ?? 0) > inDeck;
    if (!legal || !hasFreeCopy) {
      skipped += 1;
      continue;
    }

    uses.push({ slot, original, replacement: substitute.cardIdentifier, quantity });
    deckCopies.set(substitute.cardIdentifier, inDeck + quantity);
    deckCopies.set(original, (deckCopies.get(original) ?? 0) - quantity);
  }

  return { uses, skipped };
}

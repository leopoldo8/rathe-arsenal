import { buildProtectedKey } from '@rathe-arsenal/engine';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';

type TReplacementClaim = Pick<CardReplacementEntity, 'id' | 'slot' | 'replacementCardIdentifier' | 'quantity'>;

interface IDeckCopyRow {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly quantity: number;
}

function claimKey(replacement: Pick<CardReplacementEntity, 'slot' | 'replacementCardIdentifier'>): string {
  return buildProtectedKey(replacement.replacementCardIdentifier, replacement.slot);
}

/**
 * Copies of each replacement card, per (card, slot), that the engine must keep
 * out of stand-ins: the sum of the active records' quantities.
 */
export function buildProtectedCopies(
  activeReplacements: readonly TReplacementClaim[],
): ReadonlyMap<string, number> {
  const protectedCopies = new Map<string, number>();
  for (const replacement of activeReplacements) {
    const key = claimKey(replacement);
    protectedCopies.set(key, (protectedCopies.get(key) ?? 0) + replacement.quantity);
  }
  return protectedCopies;
}

/**
 * The active records a composition save left uncovered: when a slot now holds
 * fewer copies of a replacement card than the active records of that card and
 * slot claim together, every one of those records closes (AC 48), because the
 * save does not say which of them it meant to keep.
 */
export function findBrokenReplacements<T extends TReplacementClaim>(
  activeReplacements: readonly T[],
  deckCards: readonly IDeckCopyRow[],
): readonly T[] {
  const copiesInDeck = new Map<string, number>();
  for (const card of deckCards) {
    const key = buildProtectedKey(card.cardIdentifier, card.slot);
    copiesInDeck.set(key, (copiesInDeck.get(key) ?? 0) + card.quantity);
  }

  const claimed = buildProtectedCopies(activeReplacements);
  return activeReplacements.filter(
    (replacement) => (copiesInDeck.get(claimKey(replacement)) ?? 0) < (claimed.get(claimKey(replacement)) ?? 0),
  );
}

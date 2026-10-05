import { buildProtectedKey, IBreakdownEntry } from '@rathe-arsenal/engine';
import { buildProtectedCopies } from './replacement-copies';
import { CardReplacementEntity } from '../database/entities/card-replacement.entity';

/**
 * Missing copies of a card in a slot that a pick or the alternatives list may
 * still act on: the slot's `notOwned` quantity from a fresh readiness compute
 * (every copy the collection does not cover exactly, stand-in or not) minus the
 * copies active replacements already hold there (AC 1).
 */
export function computeNeeded(
  notOwned: readonly Pick<IBreakdownEntry, 'cardIdentifier' | 'slot' | 'quantity'>[],
  activeReplacements: readonly CardReplacementEntity[],
  cardIdentifier: string,
  slot: string,
): number {
  const missing = notOwned
    .filter((entry) => entry.cardIdentifier === cardIdentifier && entry.slot === slot)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const held = buildProtectedCopies(activeReplacements).get(buildProtectedKey(cardIdentifier, slot)) ?? 0;
  return Math.max(0, missing - held);
}

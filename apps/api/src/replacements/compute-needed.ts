import { buildProtectedKey, IBreakdownEntry } from '@rathe-arsenal/engine';
import { buildProtectedCopies } from './replacement-copies';
import { CardReplacementEntity, TReplacementSide } from '../database/entities/card-replacement.entity';

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

/**
 * `computeNeeded` for one side of the deck: the missing copies that belong to the deck (or to the inventory)
 * minus the copies active replacements on that side already hold there.
 */
export function computeNeededOnSide(
  notOwned: readonly Pick<IBreakdownEntry, 'cardIdentifier' | 'slot' | 'quantity' | 'inventoryQuantity'>[],
  activeReplacements: readonly CardReplacementEntity[],
  cardIdentifier: string,
  slot: string,
  side: TReplacementSide,
): number {
  const missing = notOwned
    .filter((entry) => entry.cardIdentifier === cardIdentifier && entry.slot === slot)
    .reduce((sum, entry) => {
      const inventory = entry.inventoryQuantity ?? 0;
      return sum + (side === 'inventory' ? inventory : entry.quantity - inventory);
    }, 0);
  const sideReplacements = activeReplacements.filter((replacement) => replacement.side === side);
  const held = buildProtectedCopies(sideReplacements).get(buildProtectedKey(cardIdentifier, slot)) ?? 0;
  return Math.max(0, missing - held);
}

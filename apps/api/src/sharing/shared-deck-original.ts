import type { TActiveReplacement } from './shared-deck-replacements';

export interface IDeckLineCopies {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly quantity: number;
  readonly inventoryQuantity: number;
}

const keyOf = (cardIdentifier: string, slot: string): string => `${cardIdentifier}|${slot}`;

/**
 * The deck as it stood before the sharer's picks: for each active pick, the copies it moved leave the replacement
 * and come back to the original, on the side the pick took them from. A pick the deck no longer holds in full gives
 * back only the copies still there, so no copy is invented.
 */
export function rebuildOriginalLines(lines: readonly IDeckLineCopies[], replacements: readonly TActiveReplacement[]): IDeckLineCopies[] {
  const byKey = new Map(lines.map((line) => [keyOf(line.cardIdentifier, line.slot), { ...line }] as const));

  for (const pick of replacements) {
    const stand = byKey.get(keyOf(pick.replacementCardIdentifier, pick.slot));
    if (stand === undefined) continue;
    const inventory = pick.side === 'inventory';
    const taken = Math.min(pick.quantity, inventory ? stand.inventoryQuantity : stand.quantity);
    if (taken === 0) continue;
    byKey.set(keyOf(stand.cardIdentifier, stand.slot), {
      ...stand,
      quantity: inventory ? stand.quantity : stand.quantity - taken,
      inventoryQuantity: inventory ? stand.inventoryQuantity - taken : stand.inventoryQuantity,
    });

    const original = byKey.get(keyOf(pick.originalCardIdentifier, pick.slot)) ?? {
      cardIdentifier: pick.originalCardIdentifier,
      slot: pick.slot,
      quantity: 0,
      inventoryQuantity: 0,
    };
    byKey.set(keyOf(original.cardIdentifier, original.slot), {
      ...original,
      quantity: original.quantity + (inventory ? 0 : taken),
      inventoryQuantity: original.inventoryQuantity + (inventory ? taken : 0),
    });
  }

  return [...byKey.values()].filter((line) => line.quantity + line.inventoryQuantity > 0);
}

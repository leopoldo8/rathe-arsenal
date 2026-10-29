import { TSwapSide } from '../database/entities/chat-proposal.entity';
import { IReadinessDeckRow } from '../substitution/substitution.service';

export interface ISwapMove {
  readonly slot: string;
  readonly from: string;
  readonly to: string;
  readonly quantity: number;
  readonly side: TSwapSide;
}

/**
 * The deck's lines after a swap, moved the way `ReplacementsService` moves them when it applies one: the copies come off
 * the outgoing card's lines on that side, the line goes when nothing is left on either side, and they land on the incoming
 * card's line, which is created when absent. Nothing is mutated.
 */
export function rowsAfterSwap(rows: readonly IReadinessDeckRow[], move: ISwapMove): IReadinessDeckRow[] {
  const column = move.side === 'deck' ? 'quantity' : 'inventoryQuantity';
  const other = move.side === 'deck' ? 'inventoryQuantity' : 'quantity';
  let toTake = move.quantity;
  const reduced: IReadinessDeckRow[] = [];
  for (const row of rows) {
    if (row.cardIdentifier !== move.from || row.slot !== move.slot || toTake <= 0) {
      reduced.push(row);
      continue;
    }
    const taken = Math.min(row[column], toTake);
    toTake -= taken;
    if (row[column] - taken > 0 || row[other] > 0) reduced.push({ ...row, [column]: row[column] - taken });
  }

  const target = reduced.find((row) => row.cardIdentifier === move.to && row.slot === move.slot);
  if (target === undefined) {
    return [...reduced, { cardIdentifier: move.to, slot: move.slot, quantity: 0, inventoryQuantity: 0, [column]: move.quantity }];
  }
  return reduced.map((row) => (row === target ? { ...row, [column]: row[column] + move.quantity } : row));
}

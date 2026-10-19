export const MAX_LINE_QUANTITY = 20;

export function capQuantity(quantity: number): number {
  return Math.min(quantity, MAX_LINE_QUANTITY);
}

export interface IQuantityEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

/** Sums quantities per card, keeping first-seen order and capping each at the line maximum. */
export function groupByCard(entries: readonly IQuantityEntry[]): IQuantityEntry[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.cardIdentifier, (totals.get(entry.cardIdentifier) ?? 0) + entry.quantity);
  }
  return [...totals].map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity: capQuantity(quantity) }));
}

export interface IMergeCandidate {
  readonly id: number;
  readonly cardIdentifier: string;
  readonly printing: string | null;
  readonly condition: string | null;
  readonly sold: boolean;
}

export interface IMergeTarget {
  readonly cardIdentifier: string;
  readonly printing: string | null;
  readonly condition: string | null;
}

/** Want lines merge by card; sell lines by card, printing and condition. A sold line is history, never a target. */
export function findMergeCandidate<T extends IMergeCandidate>(
  kind: 'want' | 'sell',
  lines: readonly T[],
  target: IMergeTarget,
): T | undefined {
  return lines.find(
    (line) =>
      !line.sold &&
      line.cardIdentifier === target.cardIdentifier &&
      (kind === 'want' || (line.printing === target.printing && line.condition === target.condition)),
  );
}

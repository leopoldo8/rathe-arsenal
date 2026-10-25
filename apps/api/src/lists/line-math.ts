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

export interface IMergeVersion {
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
  readonly condition: string | null;
}

export interface IMergeCandidate extends IMergeVersion {
  readonly id: number;
  readonly cardIdentifier: string;
  readonly sold: boolean;
}

export interface IMergeTarget extends IMergeVersion {
  readonly cardIdentifier: string;
}

function sameLineVersion(a: IMergeVersion, b: IMergeVersion): boolean {
  return (
    a.printingCode === b.printingCode &&
    a.edition === b.edition &&
    a.finish === b.finish &&
    (a.condition ?? '') === (b.condition ?? '')
  );
}

/** Want lines merge by card; sell lines by card and the four version fields. A sold line is history, never a target. */
export function findMergeCandidate<T extends IMergeCandidate>(
  kind: 'want' | 'sell',
  lines: readonly T[],
  target: IMergeTarget,
): T | undefined {
  return lines.find(
    (line) =>
      !line.sold &&
      line.cardIdentifier === target.cardIdentifier &&
      (kind === 'want' || sameLineVersion(line, target)),
  );
}

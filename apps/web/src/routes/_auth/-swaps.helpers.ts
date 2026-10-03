import type { ISwapRow, TSwapTab } from '../../api/swaps';

export interface ISwapsSearch {
  readonly state: TSwapTab | 'all';
  readonly tier: ReadonlyArray<1 | 2 | 3>;
  readonly deck: readonly string[];
  readonly hero: readonly string[];
  readonly confidenceMin: number;
  readonly confidenceMax: number;
}

export interface ISwapTabCounts {
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly all: number;
}

export function isVisibleSwap(row: ISwapRow): boolean {
  return row.status !== 'retired';
}

export function applyFilters(
  rows: readonly ISwapRow[],
  search: ISwapsSearch,
): readonly ISwapRow[] {
  return rows.filter((row) => {
    if (!isVisibleSwap(row)) return false;
    if (search.state !== 'all' && row.status !== search.state) return false;
    if (search.tier.length > 0 && !search.tier.includes(row.tier)) return false;
    if (search.deck.length > 0 && !search.deck.includes(String(row.trackedDeckId))) return false;
    if (search.hero.length > 0 && !search.hero.includes(row.hero)) return false;
    return row.confidence >= search.confidenceMin && row.confidence <= search.confidenceMax;
  });
}

export function computeTabCounts(rows: readonly ISwapRow[]): ISwapTabCounts {
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  for (const row of rows) {
    if (row.status === 'pending') pending++;
    else if (row.status === 'approved') approved++;
    else if (row.status === 'rejected') rejected++;
  }

  return { pending, approved, rejected, all: pending + approved + rejected };
}

export function deriveUniqueDecks(
  rows: readonly ISwapRow[],
): ReadonlyArray<{ readonly id: string; readonly name: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!isVisibleSwap(row)) continue;
    const id = String(row.trackedDeckId);
    if (!seen.has(id)) seen.set(id, row.deckName);
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

export type TConfidenceBand = 'high' | 'mid' | 'low';

export const CONFIDENCE_HIGH_FLOOR = 90;
export const CONFIDENCE_MID_FLOOR = 70;

export function resolveConfidenceBand(confidence: number): TConfidenceBand {
  if (confidence >= CONFIDENCE_HIGH_FLOOR) return 'high';
  if (confidence >= CONFIDENCE_MID_FLOOR) return 'mid';
  return 'low';
}

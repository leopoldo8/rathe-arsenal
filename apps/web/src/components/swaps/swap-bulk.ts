import type { ISwapRow, TSwapAction } from '../../api/swaps';

export type TBulkAction = 'approve' | 'reject' | 'reset';

export const BULK_MAX_ROWS = 50;

/**
 * Each bulk action reaches the target state through whichever single-swap
 * endpoints the row's current status needs; a row already in the target state
 * needs none.
 */
export function planBulkSteps(action: TBulkAction, status: ISwapRow['status']): TSwapAction[] {
  switch (action) {
    case 'approve':
      if (status === 'pending') return [{ kind: 'approve' }];
      if (status === 'rejected') return [{ kind: 'restore' }, { kind: 'approve' }];
      return [];
    case 'reject':
      if (status === 'pending') return [{ kind: 'reject' }];
      if (status === 'approved') return [{ kind: 'revert' }, { kind: 'reject' }];
      return [];
    case 'reset':
      if (status === 'approved') return [{ kind: 'revert' }];
      if (status === 'rejected') return [{ kind: 'restore' }];
      return [];
  }
}

export interface IBulkResult {
  readonly total: number;
  readonly succeeded: number;
  readonly skipped: number;
  readonly failedIds: readonly string[];
}

export type TPerformSwapAction = (swapId: string, action: TSwapAction) => Promise<unknown>;

export async function runBulk(
  rows: readonly ISwapRow[],
  action: TBulkAction,
  perform: TPerformSwapAction,
  onProgress?: (settled: number, total: number) => void,
): Promise<IBulkResult> {
  let succeeded = 0;
  let skipped = 0;
  const failedIds: string[] = [];

  for (const [index, row] of rows.entries()) {
    const steps = planBulkSteps(action, row.status);
    if (steps.length === 0) {
      skipped += 1;
    } else {
      try {
        for (const step of steps) await perform(row.id, step);
        succeeded += 1;
      } catch {
        failedIds.push(row.id);
      }
    }
    onProgress?.(index + 1, rows.length);
  }

  return { total: rows.length, succeeded, skipped, failedIds };
}

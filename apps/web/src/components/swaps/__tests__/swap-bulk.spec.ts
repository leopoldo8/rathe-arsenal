import { describe, it, expect, vi } from 'vitest';
import { BULK_MAX_ROWS, planBulkSteps, runBulk } from '../swap-bulk';
import type { TBulkAction } from '../swap-bulk';
import { makeSwapRow } from '../../../test/swap-fixtures';

describe('planBulkSteps — endpoint chosen per row status', () => {
  it.each<[TBulkAction, 'pending' | 'approved' | 'rejected', string[]]>([
    ['approve', 'pending', ['approve']],
    ['approve', 'approved', []],
    ['approve', 'rejected', ['restore', 'approve']],
    ['reject', 'pending', ['reject']],
    ['reject', 'approved', ['revert', 'reject']],
    ['reject', 'rejected', []],
    ['reset', 'pending', []],
    ['reset', 'approved', ['revert']],
    ['reset', 'rejected', ['restore']],
  ])('%s on a %s row calls %j', (action, status, expected) => {
    expect(planBulkSteps(action, status).map((step) => step.kind)).toEqual(expected);
  });

  it('caps a bulk selection at 50 rows', () => {
    expect(BULK_MAX_ROWS).toBe(50);
  });
});

describe('runBulk', () => {
  it('calls the endpoints one at a time, in selection order', async () => {
    const rows = [makeSwapRow(), makeSwapRow(), makeSwapRow()];
    let inFlight = 0;
    let maxInFlight = 0;
    const order: string[] = [];
    const perform = vi.fn(async (swapId: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      order.push(swapId);
      inFlight -= 1;
    });

    await runBulk(rows, 'approve', perform);

    expect(order).toEqual(rows.map((row) => row.id));
    expect(maxInFlight).toBe(1);
  });

  it('reports partial failure and names the failed rows so they stay selected', async () => {
    const rows = [makeSwapRow(), makeSwapRow(), makeSwapRow()];
    const perform = vi.fn(async (swapId: string) => {
      if (swapId === rows[1]?.id) throw new Error('boom');
    });

    const result = await runBulk(rows, 'approve', perform);

    expect(result).toEqual({ total: 3, succeeded: 2, skipped: 0, failedIds: [rows[1]?.id] });
  });

  it('counts a row whose second step fails as failed, not half done', async () => {
    const rejected = makeSwapRow({ status: 'rejected' });
    const perform = vi.fn(async (_id: string, step: { kind: string }) => {
      if (step.kind === 'approve') throw new Error('boom');
    });

    const result = await runBulk([rejected], 'approve', perform);

    expect(perform.mock.calls.map((call) => call[1].kind)).toEqual(['restore', 'approve']);
    expect(result.failedIds).toEqual([rejected.id]);
    expect(result.succeeded).toBe(0);
  });

  it('skips rows already in the target state without calling anything', async () => {
    const approved = makeSwapRow({ status: 'approved' });
    const perform = vi.fn();

    const result = await runBulk([approved], 'approve', perform);

    expect(perform).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 1, succeeded: 0, skipped: 1, failedIds: [] });
  });

  it('reports progress after every row, skipped or not', async () => {
    const rows = [makeSwapRow(), makeSwapRow({ status: 'approved' })];
    const onProgress = vi.fn();

    await runBulk(rows, 'approve', vi.fn(), onProgress);

    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});

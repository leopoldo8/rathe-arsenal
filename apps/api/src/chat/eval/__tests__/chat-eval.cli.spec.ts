import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatRunnerService } from '../../chat-runner.service';
import { ChatTurnQueueService } from '../../chat-turn-queue.service';
import { DEFAULT_MAX_USD, driveTurns, readOptions, toolResultsOf } from '../chat-eval.cli';

const CI_WORKFLOW = readFileSync(join(__dirname, '../../../../../../.github/workflows/ci.yml'), 'utf8');

/** An app context whose cost reads come from `spentReads` in order, and whose queue holds `turns` turns. */
function fakeApp(spentReads: readonly number[], turns: number) {
  const reads = [...spentReads];
  const dataSource = {
    query: jest.fn(async (sql: string) => (sql.includes('sum("costUsd")') ? [{ spent: reads.shift() ?? reads[0] ?? 0 }] : [])),
  };
  let left = turns;
  const queue = { claimNext: jest.fn(async () => (left-- > 0 ? { id: `turn-${turns - left}` } : null)) };
  const runner = { process: jest.fn(async () => undefined) };
  const app = {
    get: (token: unknown) => (token === DataSource ? dataSource : token === ChatTurnQueueService ? queue : token === ChatRunnerService ? runner : undefined),
  } as unknown as INestApplicationContext;
  return { app, queue, runner };
}

const DRIVE = { apiKey: 'k', openRouterModel: undefined, workers: 1, messageIds: ['m-1'] } as const;

describe('the eval run', () => {
  it('the eval stops at its cost cap and is not a CI step', async () => {
    expect(readOptions([]).maxUsd).toBe(DEFAULT_MAX_USD);
    expect(DEFAULT_MAX_USD).toBe(3);
    expect(readOptions(['--max-usd', '1.5']).maxUsd).toBe(1.5);

    const { app, queue, runner } = fakeApp([0, 0.6, 1.2], 5);
    await driveTurns(app, 'user-1', { ...DRIVE, maxUsd: 1 });

    expect(runner.process).toHaveBeenCalledTimes(2);
    expect(queue.claimNext).toHaveBeenCalledTimes(2);

    expect(CI_WORKFLOW).not.toContain('chat:eval');
    expect(CI_WORKFLOW).not.toContain('chat-eval');
  });

  it('a cap that is not a positive number is refused instead of removing the cap', () => {
    for (const value of ['abc', '', '-1', '0']) {
      expect(() => readOptions(['--max-usd', value])).toThrow(/--max-usd/);
    }
  });

  it('reads what each tool answered from the stored model content', () => {
    const contents = [
      { role: 'model', parts: [{ functionCall: { name: 'get_prices', args: {} } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'get_prices', response: { error: 'INVALID_ARGUMENTS' } } }] },
      { role: 'model', parts: [{ text: 'Sem preço.' }] },
    ];

    expect(toolResultsOf(contents)).toEqual([{ name: 'get_prices', result: { error: 'INVALID_ARGUMENTS' } }]);
    expect(toolResultsOf(null)).toEqual([]);
  });
});

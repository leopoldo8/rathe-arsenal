import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatRunnerService } from '../../chat-runner.service';
import { ChatTurnQueueService } from '../../chat-turn-queue.service';
import { DEFAULT_MAX_USD, driveTurns, readOptions, toolResultsOf } from '../chat-eval.cli';

const CI_WORKFLOW = readFileSync(join(__dirname, '../../../../../../.github/workflows/ci.yml'), 'utf8');

interface IUsageRow {
  readonly messageId: string;
  readonly costUsd: number;
}

/**
 * An app context whose `chat_usage` table is a list of rows, whose queue holds `turns` turns, and whose runner adds
 * `costPerTurn` for the eval's own message each time it processes a turn. The cost read answers only a query on
 * `chat_usage` that filters by the message ids it is given, summing the matching rows.
 */
function fakeApp(usage: IUsageRow[], turns: number, costPerTurn: number, ownMessageId: string) {
  const dataSource = {
    query: jest.fn(async (sql: string, params: readonly unknown[] = []) => {
      if (!/FROM chat_usage\b/.test(sql) || !sql.includes('ANY($1)')) return [];
      const ids = params[0] as readonly string[];
      return [{ spent: usage.filter((row) => ids.includes(row.messageId)).reduce((sum, row) => sum + row.costUsd, 0) }];
    }),
  };
  let left = turns;
  const queue = { claimNext: jest.fn(async () => (left-- > 0 ? { id: `turn-${turns - left}` } : null)) };
  const runner = {
    process: jest.fn(async () => {
      usage.push({ messageId: ownMessageId, costUsd: costPerTurn });
    }),
  };
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

    // Another run's message already cost $5: only the eval's own turns (message m-1) count toward the cap.
    const { app, queue, runner } = fakeApp([{ messageId: 'someone-else', costUsd: 5 }], 5, 0.6, 'm-1');
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

import type { DataSource } from 'typeorm';
import { HousekeepingService } from '../housekeeping.service';
import { createHousekeepingStep, HOUSEKEEPING_INTERVAL_MS } from '../housekeeping.step';

const NOTHING = { ran: true, deleted: { users: 0, decks: 0, signInCodes: 0, sessions: 0 } };

describe('createHousekeepingStep', () => {
  it('a failed tick logs and the next tick retries', async () => {
    const service = { tick: jest.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue(NOTHING) };
    const logger = { error: jest.fn() };
    const step = createHousekeepingStep({ service, logger, now: () => new Date('2026-10-25T12:00:00Z') });

    await expect(step()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({ event: 'housekeeping.error', step: 'housekeeping', error: 'connection lost' });
    await step();
    expect(service.tick).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('a failed tick logs and the next tick retries, deleting the rows with the real service', async () => {
    const statements: string[] = [];
    const manager = {
      query: jest.fn(async (sql: string) => {
        statements.push(sql);
        if (sql.includes('pg_try_advisory_xact_lock')) return [{ locked: true }];
        if (sql.startsWith('DELETE FROM "user" ')) return [{ id: 'u1', email: 'gone@test.local' }];
        if (sql.startsWith('DELETE FROM "tracked_deck"')) return [{ id: 7 }, { id: 8 }];
        return [];
      }),
    };
    // The first transaction fails before it runs anything; the second runs the work.
    const dataSource = {
      transaction: jest
        .fn()
        .mockRejectedValueOnce(new Error('connection lost'))
        .mockImplementation(async (work: (entityManager: typeof manager) => Promise<unknown>) => work(manager)),
    } as unknown as DataSource;
    const logger = { error: jest.fn() };
    const step = createHousekeepingStep({ service: new HousekeepingService(dataSource), logger, now: () => new Date('2026-10-25T12:00:00Z') });

    await step();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({ event: 'housekeeping.error', step: 'housekeeping', error: 'connection lost' });
    expect(statements).toEqual([]);

    await step();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(statements.filter((sql) => sql.startsWith('DELETE FROM'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DELETE FROM "user" WHERE "deletedAt"'),
        expect.stringContaining('DELETE FROM "tracked_deck" WHERE "deletedAt"'),
        expect.stringContaining('DELETE FROM "user_session" WHERE "revokedAt"'),
      ]),
    );
  });

  it('ticks at most once per interval after a tick that worked', async () => {
    let clock = new Date('2026-10-25T12:00:00Z');
    const service = { tick: jest.fn().mockResolvedValue(NOTHING) };
    const step = createHousekeepingStep({ service, logger: { error: jest.fn() }, now: () => clock });

    await step();
    clock = new Date(clock.getTime() + HOUSEKEEPING_INTERVAL_MS - 1);
    await step();
    expect(service.tick).toHaveBeenCalledTimes(1);

    clock = new Date(clock.getTime() + 1);
    await step();
    expect(service.tick).toHaveBeenCalledTimes(2);
  });

  it('hands the tick the time it read, so one pass judges every row by the same clock', async () => {
    const at = new Date('2026-10-25T12:00:00Z');
    const service = { tick: jest.fn().mockResolvedValue(NOTHING) };

    await createHousekeepingStep({ service, logger: { error: jest.fn() }, now: () => at })();

    expect(service.tick).toHaveBeenCalledWith(at);
  });
});

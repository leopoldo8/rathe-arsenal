import { createReferenceStep } from '../reference-step';

describe('reference loop step', () => {
  it('runs a source only when it is due', async () => {
    const now = new Date('2026-10-11T12:00:00Z');
    const clock = { now: () => now, sleep: async () => undefined };
    const make = (tournamentsDue: boolean, rulesDue: boolean) => {
      const tournaments = { isDue: jest.fn().mockResolvedValue(tournamentsDue), sync: jest.fn().mockResolvedValue(null) };
      const rules = { isDue: jest.fn().mockResolvedValue(rulesDue), importIndex: jest.fn().mockResolvedValue(false) };
      return { tournaments, rules, step: createReferenceStep({ tournaments, rules, logger: { error: jest.fn() }, clock }) };
    };

    const due = make(true, true);
    const fresh = make(false, false);
    const mixed = make(true, false);
    await due.step();
    await fresh.step();
    await mixed.step();

    expect(due.tournaments.isDue).toHaveBeenCalledWith(now);
    expect(due.tournaments.sync).toHaveBeenCalledWith(clock);
    expect(due.rules.importIndex).toHaveBeenCalledWith(undefined, now);
    expect(fresh.tournaments.sync).not.toHaveBeenCalled();
    expect(fresh.rules.importIndex).not.toHaveBeenCalled();
    expect(mixed.tournaments.sync).toHaveBeenCalledTimes(1);
    expect(mixed.rules.importIndex).not.toHaveBeenCalled();
  });

  it('a failing source does not stop the other', async () => {
    const tournaments = { isDue: jest.fn().mockRejectedValue(new Error('db down')), sync: jest.fn() };
    const rules = { isDue: jest.fn().mockResolvedValue(true), importIndex: jest.fn().mockResolvedValue(true) };
    const logger = { error: jest.fn() };

    await createReferenceStep({ tournaments, rules, logger })();

    expect(logger.error).toHaveBeenCalledWith({ event: 'tournament.sync.error', error: 'db down' });
    expect(rules.importIndex).toHaveBeenCalledTimes(1);
  });
});

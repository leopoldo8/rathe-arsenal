import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { FirecrawlUsageEntity } from '../../database/entities/firecrawl-usage.entity';
import { CreditBudgetService } from '../credit-budget.service';

const OCTOBER = new Date('2026-10-15T12:00:00Z');
const NOVEMBER = new Date('2026-11-02T08:00:00Z');

async function buildService(
  env: Record<string, unknown>,
  usedByMonth: Record<string, number>,
): Promise<{ service: CreditBudgetService; repo: jest.Mocked<Repository<FirecrawlUsageEntity>> }> {
  const repo = createMock<Repository<FirecrawlUsageEntity>>();
  repo.findOne.mockImplementation((async (options: { where: { month: string } }) => {
    const credits = usedByMonth[options.where.month];
    return credits === undefined ? null : { month: options.where.month, credits };
  }) as never);
  const config = createMock<ConfigService>();
  (config.get as jest.Mock).mockImplementation((key: string) => env[key]);
  const moduleRef = await Test.createTestingModule({
    providers: [
      CreditBudgetService,
      { provide: getRepositoryToken(FirecrawlUsageEntity), useValue: repo },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  return { service: moduleRef.get(CreditBudgetService), repo };
}

describe('CreditBudgetService', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('stops automatic lookups when what is left of the month budget would not pay for one pass', async () => {
    const enough = await buildService({}, { '2026-10': 850 });
    expect(await enough.service.allowAutomaticLookups(OCTOBER)).toBe(true);
    expect(warn).not.toHaveBeenCalled();

    const short = await buildService({}, { '2026-10': 851, '2026-11': 851 });
    expect(await short.service.allowAutomaticLookups(OCTOBER)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    expect(await short.service.allowAutomaticLookups(OCTOBER)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    expect(await short.service.allowAutomaticLookups(NOVEMBER)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);

    const custom = await buildService(
      { FIRECRAWL_MONTHLY_CREDIT_BUDGET: 500, FIRECRAWL_CREDITS_PER_PASS: 100 },
      { '2026-10': 400 },
    );
    expect(await custom.service.allowAutomaticLookups(OCTOBER)).toBe(true);
    const customShort = await buildService(
      { FIRECRAWL_MONTHLY_CREDIT_BUDGET: 500, FIRECRAWL_CREDITS_PER_PASS: 100 },
      { '2026-10': 401 },
    );
    expect(await customShort.service.allowAutomaticLookups(OCTOBER)).toBe(false);
  });

  it('reports the month status without logging', async () => {
    const { service } = await buildService({}, { '2026-10': 120, '2026-11': 0 });

    expect(await service.status(OCTOBER)).toEqual({ creditsUsed: 120, budget: 1000, lookupsStopped: false });
    expect(await service.status(NOVEMBER)).toEqual({ creditsUsed: 0, budget: 1000, lookupsStopped: false });
    const stopped = await buildService({}, { '2026-10': 851 });
    expect(await stopped.service.status(OCTOBER)).toEqual({ creditsUsed: 851, budget: 1000, lookupsStopped: true });
    expect(warn).not.toHaveBeenCalled();
  });

  it('lets the pass run only while what is left would pay for it', async () => {
    const fits = await buildService({}, { '2026-10': 850 });
    expect(await fits.service.passFits(OCTOBER)).toBe(true);
    const short = await buildService({}, { '2026-10': 851 });
    expect(await short.service.passFits(OCTOBER)).toBe(false);
    const fresh = await buildService({}, { '2026-10': 999 });
    expect(await fresh.service.passFits(NOVEMBER)).toBe(true);
  });

  it('adds credits to the month of the call with one statement', async () => {
    const { service, repo } = await buildService({}, {});

    await service.record(5, new Date('2026-11-01T00:00:00Z'));

    expect(repo.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (month) DO UPDATE'), ['2026-11', 5]);
  });
});

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { FirecrawlUsageEntity } from '../../database/entities/firecrawl-usage.entity';
import { CreditBudgetService } from '../credit-budget.service';
import { StoreAnswersService } from '../store-answers.service';
import { VariantFetchQueueService } from '../variant-fetch-queue.service';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { StoreStockVariantEntity } from '../../database/entities/store-stock-variant.entity';
import { VariantFetchJobEntity } from '../../database/entities/variant-fetch-job.entity';

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

const LIST_OPEN = new Date('2026-10-25T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_CARD = 'pack-hunt-red';

/** The owner's list opened against the real budget, queue and answers services, with the stores' rows mocked. */
async function openListWithUsed(used: number): Promise<{ states: Map<string, string>; queued: string[][] }> {
  const usage = createMock<Repository<FirecrawlUsageEntity>>();
  usage.findOne.mockResolvedValue({ month: '2026-10', credits: used } as never);
  const jobs = createMock<Repository<VariantFetchJobEntity>>();
  const queued: string[][] = [];
  jobs.query.mockImplementation((async (sql: string, params: unknown[]) => {
    if (String(sql).includes('INSERT INTO variant_fetch_job')) queued.push(params[1] as string[]);
    return [];
  }) as never);
  const pass = new Date('2026-10-22T03:00:00Z');
  const stores = createMock<Repository<StoreEntity>>();
  stores.findOne.mockResolvedValue({ id: 1, lastAvailabilityPassAt: pass } as never);
  const stock = createMock<Repository<StoreStockEntity>>();
  stock.find.mockResolvedValue([
    {
      storeId: 1,
      cardIdentifier: STALE_CARD,
      priceCents: 6999,
      quantity: 3,
      productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=pack-hunt-red',
      lastFetchedAt: new Date(LIST_OPEN.getTime() - 40 * DAY_MS),
      listedInStockAt: pass,
    },
  ] as never);
  const config = createMock<ConfigService>();
  (config.get as jest.Mock).mockReturnValue(undefined);
  const moduleRef = await Test.createTestingModule({
    providers: [
      StoreAnswersService,
      VariantFetchQueueService,
      CreditBudgetService,
      { provide: getRepositoryToken(FirecrawlUsageEntity), useValue: usage },
      { provide: getRepositoryToken(VariantFetchJobEntity), useValue: jobs },
      { provide: getRepositoryToken(StoreEntity), useValue: stores },
      { provide: getRepositoryToken(StoreStockEntity), useValue: stock },
      { provide: getRepositoryToken(StoreStockVariantEntity), useValue: createMock<Repository<StoreStockVariantEntity>>() },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();
  const states = await moduleRef.get(StoreAnswersService).openForOwner([STALE_CARD], LIST_OPEN);
  return { states, queued };
}

describe('CreditBudgetService', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('stops automatic lookups when what is left would not pay for one pass', async () => {
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

  it('stops automatic lookups when what is left would not pay for one pass: 850 used queues the lookup, 851 queues none and the line has no price', async () => {
    const at850 = await openListWithUsed(850);
    expect(at850.queued).toEqual([[STALE_CARD]]);
    expect(at850.states.get(STALE_CARD)).toBe('looking_up');

    const at851 = await openListWithUsed(851);
    expect(at851.queued).toEqual([]);
    expect(at851.states.get(STALE_CARD)).toBe('no_price');
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

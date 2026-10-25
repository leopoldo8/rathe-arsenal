import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource } from 'typeorm';
import { StoreEntity, StoreScrapeRunEntity, StoreStockEntity } from '../../database/entities';
import { CardNameMatcherService } from '../card-name-matcher.service';
import { SbraubleScraperService } from '../sbrauble-scraper.service';
import { StoreIngestionService } from '../store-ingestion.service';
import { runPendingUrlSync } from '../variant-queue-worker';
import { createAvailabilityStep } from '../availability-pass';
import { CreditBudgetService } from '../credit-budget.service';
import { FirecrawlClientService } from '../firecrawl-client.service';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import type { IScrapedProduct } from '../types/scraped-product';

const NOW = new Date('2026-10-25T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const PRODUCTS: IScrapedProduct[] = [
  { rawName: 'Card Alpha', priceCents: null, quantity: 0, productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=alpha' },
  { rawName: 'Card Beta', priceCents: null, quantity: 0, productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=beta' },
];

async function* stream(products: IScrapedProduct[], failAfter?: number): AsyncGenerator<IScrapedProduct> {
  for (const [index, product] of products.entries()) {
    if (failAfter === index) throw new Error('Firecrawl returned HTTP 502');
    yield product;
  }
  if (failAfter === products.length) throw new Error('Firecrawl returned HTTP 502');
}

interface IStoreState {
  lastAvailabilityPassAt: Date | null;
  lastUrlSyncErrorAt: Date | null;
  urlSyncRequestedAt: Date | null;
  urlSyncRunningAt: Date | null;
}

async function build(
  store: Partial<IStoreState>,
  env: Record<string, unknown> = {},
  budgetFits = true,
) {
  const storeRow = {
    id: 1,
    slug: 'cupula-dt',
    active: true,
    baseUrl: 'https://www.cupuladt.com.br',
    lastAvailabilityPassAt: null,
    lastUrlSyncErrorAt: null,
    urlSyncRequestedAt: null,
    urlSyncRunningAt: null,
    ...store,
  } as unknown as StoreEntity;
  const storeRepo = {
    find: jest.fn().mockResolvedValue([storeRow]),
    findOne: jest.fn().mockResolvedValue(storeRow),
    update: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([[{ slug: 'cupula-dt' }], 1]),
  };
  const stockRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((dto) => dto),
  };
  const scraper = createMock<SbraubleScraperService>();
  const matcher = createMock<CardNameMatcherService>();
  (matcher.match as jest.Mock).mockImplementation(async (_slug: string, rawName: string) => [
    { cardIdentifier: rawName === 'Card Alpha' ? 'card-alpha' : 'card-beta', source: 'deterministic' },
  ]);
  const moduleRef = await Test.createTestingModule({
    providers: [
      StoreIngestionService,
      { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
      { provide: getRepositoryToken(StoreScrapeRunEntity), useValue: createMock() },
      { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
      { provide: SbraubleScraperService, useValue: scraper },
      { provide: CardNameMatcherService, useValue: matcher },
      { provide: DataSource, useValue: createMock<DataSource>() },
    ],
  }).compile();
  const ingestion = moduleRef.get(StoreIngestionService);
  const logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
  const budget = { passFits: jest.fn().mockResolvedValue(budgetFits) };
  const config = createMock<ConfigService>();
  (config.get as jest.Mock).mockImplementation((key: string) => env[key]);
  const step = createAvailabilityStep({
    ingestion,
    budget,
    config,
    logger,
    now: () => NOW,
    runPendingUrlSync: () => runPendingUrlSync({ ingestion, logger }),
  });
  return { step, storeRepo, stockRepo, scraper, budget, ingestion, logger, storeRow };
}

function passStamps(storeRepo: { update: jest.Mock }): Date[] {
  return storeRepo.update.mock.calls
    .map(([, fields]) => (fields as { lastAvailabilityPassAt?: Date }).lastAvailabilityPassAt)
    .filter((stamp): stamp is Date => stamp instanceof Date);
}

function rowStamps(stockRepo: { update: jest.Mock }): Array<{ ids: string[]; at: Date }> {
  return stockRepo.update.mock.calls
    .filter(([, fields]) => (fields as { listedInStockAt?: Date }).listedInStockAt instanceof Date)
    .map(([criteria, fields]) => ({
      ids: (criteria as { cardIdentifier: { value: string[] } }).cardIdentifier.value,
      at: (fields as { listedInStockAt: Date }).listedInStockAt,
    }));
}

describe('availability pass', () => {
  it('runs the pass when the last one is past the interval and stamps every listed row', async () => {
    const eightDays = await build({ lastAvailabilityPassAt: new Date(NOW.getTime() - 8 * DAY_MS) });
    (eightDays.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));

    await eightDays.step();

    expect(eightDays.scraper.scrapeStore).toHaveBeenCalledTimes(1);
    const stamps = rowStamps(eightDays.stockRepo);
    expect(stamps).toHaveLength(1);
    expect([...stamps[0]!.ids].sort()).toEqual(['card-alpha', 'card-beta']);
    expect(passStamps(eightDays.storeRepo)).toEqual([stamps[0]!.at]);

    const sixDays = await build({ lastAvailabilityPassAt: new Date(NOW.getTime() - 6 * DAY_MS) });
    await sixDays.step();
    expect(sixDays.scraper.scrapeStore).not.toHaveBeenCalled();

    const neverRan = await build({ lastAvailabilityPassAt: null });
    (neverRan.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await neverRan.step();
    expect(neverRan.scraper.scrapeStore).toHaveBeenCalledTimes(1);

    const shorterInterval = await build(
      { lastAvailabilityPassAt: new Date(NOW.getTime() - 4 * DAY_MS) },
      { STORE_AVAILABILITY_PASS_DAYS: 3 },
    );
    (shorterInterval.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await shorterInterval.step();
    expect(shorterInterval.scraper.scrapeStore).toHaveBeenCalledTimes(1);

    const stillWithin = await build(
      { lastAvailabilityPassAt: new Date(NOW.getTime() - 2 * DAY_MS) },
      { STORE_AVAILABILITY_PASS_DAYS: 3 },
    );
    await stillWithin.step();
    expect(stillWithin.scraper.scrapeStore).not.toHaveBeenCalled();
  });

  it('does not start a second pass while one is queued or running', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);
    const queued = await build({ lastAvailabilityPassAt: old, urlSyncRequestedAt: new Date(NOW.getTime() - MINUTE_MS) });
    await queued.step();
    expect(queued.scraper.scrapeStore).not.toHaveBeenCalled();
    expect(queued.storeRepo.update).not.toHaveBeenCalled();

    const running = await build({ lastAvailabilityPassAt: old, urlSyncRunningAt: new Date(NOW.getTime() - MINUTE_MS) });
    await running.step();
    expect(running.scraper.scrapeStore).not.toHaveBeenCalled();
  });

  it('a failed pass marks nothing and waits an hour', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);

    const failing = await build({ lastAvailabilityPassAt: old });
    (failing.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS, 1));
    await failing.step();
    expect(failing.scraper.scrapeStore).toHaveBeenCalledTimes(1);
    expect(rowStamps(failing.stockRepo)).toEqual([]);
    expect(passStamps(failing.storeRepo)).toEqual([]);
    expect(failing.storeRepo.update).toHaveBeenCalledWith(
      { slug: 'cupula-dt' },
      expect.objectContaining({ lastUrlSyncError: 'Firecrawl returned HTTP 502' }),
    );

    const tooSoon = await build({ lastAvailabilityPassAt: old, lastUrlSyncErrorAt: new Date(NOW.getTime() - 59 * MINUTE_MS) });
    await tooSoon.step();
    expect(tooSoon.scraper.scrapeStore).not.toHaveBeenCalled();

    const later = await build({ lastAvailabilityPassAt: old, lastUrlSyncErrorAt: new Date(NOW.getTime() - 61 * MINUTE_MS) });
    (later.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await later.step();
    expect(later.scraper.scrapeStore).toHaveBeenCalledTimes(1);
  });

  it('the pass waits for the next month and the manual sync always runs', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);

    const broke = await build({ lastAvailabilityPassAt: old }, {}, false);
    await broke.step();
    expect(broke.budget.passFits).toHaveBeenCalledWith(NOW);
    expect(broke.scraper.scrapeStore).not.toHaveBeenCalled();
    expect(passStamps(broke.storeRepo)).toEqual([]);

    const manual = await build({ lastAvailabilityPassAt: old }, {}, false);
    (manual.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await runPendingUrlSync({ ingestion: manual.ingestion, logger: manual.logger });
    expect(manual.scraper.scrapeStore).toHaveBeenCalledTimes(1);
    expect(manual.budget.passFits).not.toHaveBeenCalled();
  });

  it('counts the credits of a manual sync whatever the budget says', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    const body = JSON.stringify({ success: true, data: { rawHtml: '<html>ok</html>' } });
    fetchGuard.guardedFetch.mockResolvedValue({ status: 200, headers: {}, body: new Uint8Array(Buffer.from(body)) } as never);
    const config = createMock<ConfigService>();
    const env: Record<string, unknown> = { SCRAPER_FETCH_PROVIDER: 'firecrawl', FIRECRAWL_API_KEY: 'fc-secret' };
    (config.get as jest.Mock).mockImplementation((key: string) => env[key]);
    const stopped = createMock<CreditBudgetService>();
    stopped.allowAutomaticLookups.mockResolvedValue(false);
    stopped.passFits.mockResolvedValue(false);
    const firecrawl = new FirecrawlClientService(config, fetchGuard, stopped);

    await firecrawl.scrapeHtml('https://www.cupuladt.com.br/?view=ecom/itens&tcg=8', 'listing');

    expect(stopped.record).toHaveBeenCalledWith(1);
    expect(stopped.allowAutomaticLookups).not.toHaveBeenCalled();
    expect(stopped.passFits).not.toHaveBeenCalled();
  });
});

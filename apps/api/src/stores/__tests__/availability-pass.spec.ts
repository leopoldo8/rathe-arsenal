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
  lastUrlSyncError: string | null;
  lastUrlSyncErrorAt: Date | null;
  urlSyncFailureCount: number;
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
    lastUrlSyncError: null,
    lastUrlSyncErrorAt: null,
    urlSyncFailureCount: 0,
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
    runPendingUrlSync: () => runPendingUrlSync({ ingestion, logger, config }),
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
    const fifteenDays = await build({ lastAvailabilityPassAt: new Date(NOW.getTime() - 15 * DAY_MS) });
    (fifteenDays.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));

    await fifteenDays.step();

    expect(fifteenDays.scraper.scrapeStore).toHaveBeenCalledTimes(1);
    const stamps = rowStamps(fifteenDays.stockRepo);
    expect(stamps).toHaveLength(1);
    expect([...stamps[0]!.ids].sort()).toEqual(['card-alpha', 'card-beta']);
    expect(passStamps(fifteenDays.storeRepo)).toEqual([stamps[0]!.at]);

    // The default interval is two weeks: a pass eight days old is not due yet.
    const eightDays = await build({ lastAvailabilityPassAt: new Date(NOW.getTime() - 8 * DAY_MS) });
    await eightDays.step();
    expect(eightDays.scraper.scrapeStore).not.toHaveBeenCalled();

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

  it('waits longer after each consecutive failure: 4h after the second, 12h after the third, 24h after the fourth', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);
    const cases: Array<{ failures: number; waitHours: number }> = [
      { failures: 2, waitHours: 4 },
      { failures: 3, waitHours: 12 },
      { failures: 4, waitHours: 24 },
    ];
    for (const { failures, waitHours } of cases) {
      const tooSoon = await build({
        lastAvailabilityPassAt: old,
        urlSyncFailureCount: failures,
        lastUrlSyncError: 'did not return a listing page',
        lastUrlSyncErrorAt: new Date(NOW.getTime() - (waitHours * 60 - 1) * MINUTE_MS),
      });
      await tooSoon.step();
      expect(tooSoon.scraper.scrapeStore).not.toHaveBeenCalled();

      const due = await build({
        lastAvailabilityPassAt: old,
        urlSyncFailureCount: failures,
        lastUrlSyncError: 'did not return a listing page',
        lastUrlSyncErrorAt: new Date(NOW.getTime() - (waitHours * 60 + 1) * MINUTE_MS),
      });
      (due.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
      await due.step();
      expect(due.scraper.scrapeStore).toHaveBeenCalledTimes(1);
    }
  });

  it('after five consecutive failures it waits for the next scheduled sweep', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);
    const spent = { lastAvailabilityPassAt: old, urlSyncFailureCount: 5, lastUrlSyncError: 'did not return a listing page' };

    const threeDaysLater = await build({ ...spent, lastUrlSyncErrorAt: new Date(NOW.getTime() - 3 * DAY_MS) });
    await threeDaysLater.step();
    expect(threeDaysLater.scraper.scrapeStore).not.toHaveBeenCalled();

    const nextWindow = await build({ ...spent, lastUrlSyncErrorAt: new Date(NOW.getTime() - 15 * DAY_MS) });
    (nextWindow.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await nextWindow.step();
    expect(nextWindow.scraper.scrapeStore).toHaveBeenCalledTimes(1);
  });

  it('does not retry while Firecrawl is out of credits, until its credits reset', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);
    const resetAt = new Date(NOW.getTime() + 2 * DAY_MS);
    const outOfCredits = {
      lastAvailabilityPassAt: old,
      urlSyncFailureCount: 1,
      lastUrlSyncError: `Firecrawl returned HTTP 402: Insufficient credits, with plan credits resetting at ${resetAt.toISOString()}.`,
      lastUrlSyncErrorAt: new Date(NOW.getTime() - 3 * 60 * MINUTE_MS),
    };

    const beforeReset = await build(outOfCredits);
    await beforeReset.step();
    expect(beforeReset.scraper.scrapeStore).not.toHaveBeenCalled();

    const afterReset = await build({ ...outOfCredits, lastUrlSyncErrorAt: new Date(NOW.getTime() - 3 * DAY_MS),
      lastUrlSyncError: `Firecrawl returned HTTP 402: credits resetting at ${new Date(NOW.getTime() - MINUTE_MS).toISOString()}.` });
    (afterReset.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await afterReset.step();
    expect(afterReset.scraper.scrapeStore).toHaveBeenCalledTimes(1);
  });

  it('counts consecutive failures, logs the attempt and the next try, and a completed pass resets the count', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);

    const secondFailure = await build({
      lastAvailabilityPassAt: old,
      urlSyncFailureCount: 1,
      lastUrlSyncError: 'did not return a listing page',
      lastUrlSyncErrorAt: new Date(NOW.getTime() - 2 * 60 * MINUTE_MS),
    });
    (secondFailure.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS, 1));
    await secondFailure.step();
    expect(secondFailure.storeRepo.update).toHaveBeenCalledWith(
      { slug: 'cupula-dt' },
      expect.objectContaining({ urlSyncFailureCount: 2 }),
    );
    const backoff = secondFailure.logger.warn.mock.calls.map(([entry]) => entry).find((entry) => entry.event === 'url-sync.backoff');
    expect(backoff).toEqual(expect.objectContaining({ storeSlug: 'cupula-dt', attempt: 2, outOfCredits: false }));
    const failedAt = (secondFailure.storeRepo.update.mock.calls.find(([, fields]) => fields.lastUrlSyncErrorAt)?.[1] as { lastUrlSyncErrorAt: Date }).lastUrlSyncErrorAt;
    expect(backoff.nextAttemptAt).toBe(new Date(failedAt.getTime() + 4 * 60 * MINUTE_MS).toISOString());

    const recovered = await build({
      lastAvailabilityPassAt: old,
      urlSyncFailureCount: 3,
      lastUrlSyncError: 'did not return a listing page',
      lastUrlSyncErrorAt: new Date(NOW.getTime() - 13 * 60 * MINUTE_MS),
    });
    (recovered.scraper.scrapeStore as jest.Mock).mockReturnValue(stream(PRODUCTS));
    await recovered.step();
    expect(recovered.storeRepo.update).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({ urlSyncFailureCount: 0, lastUrlSyncError: null }),
    );
  });

  it('a 402 does not grow the failure count, so the backoff restarts where it was once credits are back', async () => {
    const old = new Date(NOW.getTime() - 30 * DAY_MS);
    const failing = await build({ lastAvailabilityPassAt: old, urlSyncFailureCount: 2,
      lastUrlSyncError: 'did not return a listing page', lastUrlSyncErrorAt: new Date(NOW.getTime() - 5 * 60 * MINUTE_MS) });
    (failing.scraper.scrapeStore as jest.Mock).mockImplementation(async function* () {
      throw new Error('Firecrawl returned HTTP 402: Insufficient credits');
    });
    await failing.step();
    expect(failing.storeRepo.update).toHaveBeenCalledWith(
      { slug: 'cupula-dt' },
      expect.objectContaining({ urlSyncFailureCount: 2 }),
    );
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

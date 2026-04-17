import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
  EStoreScrapeRunStatus,
} from '../../database/entities';
import { CardNameMatcherService } from '../card-name-matcher.service';
import { SbraubleScraperService } from '../sbrauble-scraper.service';
import { StoreIngestionService } from '../store-ingestion.service';
import type { IScrapedProduct } from '../types/scraped-product';
import type { ICardMatchResult } from '../card-name-matcher.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<StoreEntity> = {}): StoreEntity {
  return {
    id: 1,
    slug: 'cupula-dt',
    name: 'Cúpula DT',
    baseUrl: 'https://www.cupuladt.com.br',
    listingPath: '/?view=ecom/itens&tcg=8',
    rateLimitMs: 1500,
    active: true,
    lastScrapedAt: null,
    lastFetchedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as StoreEntity;
}

function makeRun(overrides: Partial<StoreScrapeRunEntity> = {}): StoreScrapeRunEntity {
  return {
    id: 1,
    storeId: 1,
    startedAt: new Date(),
    finishedAt: null,
    productsFetched: 0,
    productsMatched: 0,
    productsUnmatched: 0,
    rowsUpserted: 0,
    rowsZeroed: 0,
    deltaPercent: null,
    status: EStoreScrapeRunStatus.Running,
    errorMessage: null,
    forcedOverride: false,
    store: {} as StoreEntity,
    ...overrides,
  } as StoreScrapeRunEntity;
}

function makeStockRow(
  cardIdentifier: string,
  overrides: Partial<StoreStockEntity> = {},
): StoreStockEntity {
  return {
    id: Math.floor(Math.random() * 10000),
    storeId: 1,
    cardIdentifier,
    priceCents: 1000,
    quantity: 5,
    productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
    productNameRaw: 'Test Card',
    lastFetchedAt: new Date('2026-04-01'),
    store: {} as StoreEntity,
    ...overrides,
  } as StoreStockEntity;
}

function makeProduct(
  rawName: string,
  overrides: Partial<IScrapedProduct> = {},
): IScrapedProduct {
  return {
    rawName,
    priceCents: 1000,
    quantity: 5,
    productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
    ...overrides,
  };
}

async function* makeStream(products: IScrapedProduct[]): AsyncGenerator<IScrapedProduct> {
  for (const p of products) {
    yield p;
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('StoreIngestionService', () => {
  let service: StoreIngestionService;

  let storeRepo: ReturnType<typeof createMock<{ findOne: jest.Mock; update: jest.Mock }>>;
  let runRepo: ReturnType<
    typeof createMock<{
      findOne: jest.Mock;
      count: jest.Mock;
      save: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    }>
  >;
  let stockRepo: ReturnType<typeof createMock<{ find: jest.Mock }>>;
  let scraper: ReturnType<typeof createMock<SbraubleScraperService>>;
  let matcher: ReturnType<typeof createMock<CardNameMatcherService>>;
  let dataSource: ReturnType<typeof createMock<DataSource>>;

  // A minimal transaction mock that executes the callback immediately.
  const transactionMock = jest.fn((cb: (em: unknown) => Promise<void>) =>
    cb({
      createQueryBuilder: () => ({
        insert: () => ({
          into: () => ({
            values: () => ({
              orUpdate: () => ({ execute: jest.fn().mockResolvedValue(undefined) }),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({ execute: jest.fn().mockResolvedValue(undefined) }),
          }),
        }),
      }),
    }),
  );

  beforeEach(async () => {
    storeRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as typeof storeRepo;

    runRepo = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(1), // default: has completed runs
      save: jest.fn(),
      create: jest.fn((dto) => dto),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as typeof runRepo;

    stockRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as typeof stockRepo;

    scraper = createMock<SbraubleScraperService>();
    matcher = createMock<CardNameMatcherService>();
    dataSource = createMock<DataSource>();
    (dataSource.transaction as jest.Mock).mockImplementation(transactionMock);
    transactionMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreIngestionService,
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreScrapeRunEntity), useValue: runRepo },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: SbraubleScraperService, useValue: scraper },
        { provide: CardNameMatcherService, useValue: matcher },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(StoreIngestionService);
  });

  afterAll(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // Store loading
  // ---------------------------------------------------------------------------

  describe('store loading', () => {
    it('throws NotFoundException when store does not exist', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.runScrape('unknown-slug')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when store.active is false', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore({ active: false }));

      await expect(service.runScrape('cupula-dt')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Soft lock
  // ---------------------------------------------------------------------------

  describe('soft lock', () => {
    it('throws SCRAPE_ALREADY_RUNNING when a non-stale running row exists', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(
        makeRun({ status: EStoreScrapeRunStatus.Running, startedAt: new Date() }),
      );

      await expect(service.runScrape('cupula-dt')).rejects.toThrow('SCRAPE_ALREADY_RUNNING');
    });

    it('allows a new run when the running row is stale (>30 min)', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());

      // First call to findOne = stale running row; second call = no delta-guard row.
      const staleDate = new Date(Date.now() - 31 * 60 * 1000);
      (runRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(makeRun({ status: EStoreScrapeRunStatus.Running, startedAt: staleDate }))
        .mockResolvedValueOnce(null); // delta-guard query

      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 5 }));
      (stockRepo.find as jest.Mock).mockResolvedValue([]);
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([]));

      const summary = await service.runScrape('cupula-dt');

      expect(summary.runId).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Delta-guard lock
  // ---------------------------------------------------------------------------

  describe('delta-guard lock', () => {
    it('throws SCRAPE_PAUSED_OPERATOR_OVERRIDE_REQUIRED when last run is paused_delta_guard', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // soft lock: no running row
        .mockResolvedValueOnce(
          makeRun({ status: EStoreScrapeRunStatus.PausedDeltaGuard, deltaPercent: 95 }),
        ); // delta-guard check

      await expect(service.runScrape('cupula-dt')).rejects.toThrow(
        'SCRAPE_PAUSED_OPERATOR_OVERRIDE_REQUIRED',
      );
    });

    it('proceeds and sets forcedOverride=true when force=true bypasses paused_delta_guard', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // soft lock
        .mockResolvedValueOnce(
          makeRun({ status: EStoreScrapeRunStatus.PausedDeltaGuard, deltaPercent: 95 }),
        ); // delta-guard

      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 10, forcedOverride: true }));
      (stockRepo.find as jest.Mock).mockResolvedValue([]);
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([]));

      const summary = await service.runScrape('cupula-dt', { force: true });

      expect(summary.forcedOverride).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path: first run
  // ---------------------------------------------------------------------------

  describe('first run', () => {
    beforeEach(() => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null); // no locks
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 1 }));
      (stockRepo.find as jest.Mock).mockResolvedValue([]); // empty existing stock
    });

    it('returns correct counters when 100 products scrape with 95 matched', async () => {
      const products = Array.from({ length: 100 }, (_, i) =>
        makeProduct(`Card ${i}`, { productUrl: `https://www.cupuladt.com.br/?view=ecom/item&id=${i}` }),
      );
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream(products));

      // First 95 match, last 5 do not
      (matcher.match as jest.Mock).mockImplementation(
        (_slug: string, rawName: string): Promise<readonly ICardMatchResult[]> => {
          const idx = parseInt(rawName.replace('Card ', ''), 10);
          if (idx < 95) {
            return Promise.resolve([{ cardIdentifier: `card-${idx}`, source: 'deterministic' }]);
          }
          return Promise.resolve([]);
        },
      );

      // First-run exemption: zero completed runs
      (runRepo.count as jest.Mock).mockResolvedValue(0);

      const summary = await service.runScrape('cupula-dt');

      expect(summary.productsFetched).toBe(100);
      expect(summary.productsMatched).toBe(95);
      expect(summary.productsUnmatched).toBe(5);
      expect(summary.rowsUpserted).toBe(95);
      expect(summary.rowsZeroed).toBe(0);
      // delta is null because existingCount was 0 (first run)
      expect(summary.deltaPercent).toBeNull();
      expect(summary.forcedOverride).toBe(false);
    });

    it('completes with all-unmatched products (productsMatched=0, rowsUpserted=0)', async () => {
      const products = [makeProduct('Totally Unknown Product')];
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream(products));
      (matcher.match as jest.Mock).mockResolvedValue([]);

      const summary = await service.runScrape('cupula-dt');

      expect(summary.productsFetched).toBe(1);
      expect(summary.productsMatched).toBe(0);
      expect(summary.productsUnmatched).toBe(1);
      expect(summary.rowsUpserted).toBe(0);
      expect(summary.rowsZeroed).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path: subsequent runs
  // ---------------------------------------------------------------------------

  describe('subsequent runs', () => {
    const CARD_ID = 'test-card';

    beforeEach(() => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null);
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 2 }));
    });

    it('reports rowsUpserted=0, rowsZeroed=0 when stock is identical', async () => {
      const existingRow = makeStockRow(CARD_ID, { priceCents: 1000, quantity: 5 });
      (stockRepo.find as jest.Mock).mockResolvedValue([existingRow]);
      (scraper.scrapeStore as jest.Mock).mockReturnValue(
        makeStream([makeProduct('Test Card', { priceCents: 1000, quantity: 5 })]),
      );
      (matcher.match as jest.Mock).mockResolvedValue([{
        cardIdentifier: CARD_ID,
        source: 'deterministic',
      }]);

      const summary = await service.runScrape('cupula-dt');

      expect(summary.rowsUpserted).toBe(0);
      expect(summary.rowsZeroed).toBe(0);
    });

    it('reports rowsUpserted=1 when a card price changes', async () => {
      const existingRow = makeStockRow(CARD_ID, { priceCents: 1000, quantity: 5 });
      (stockRepo.find as jest.Mock).mockResolvedValue([existingRow]);
      (scraper.scrapeStore as jest.Mock).mockReturnValue(
        makeStream([makeProduct('Test Card', { priceCents: 1500, quantity: 5 })]),
      );
      (matcher.match as jest.Mock).mockResolvedValue([{
        cardIdentifier: CARD_ID,
        source: 'deterministic',
      }]);
      // 1 upsert / 1 existing = 100% delta — bypass guard via first-run exemption.
      (runRepo.count as jest.Mock).mockResolvedValue(0);

      const summary = await service.runScrape('cupula-dt');

      expect(summary.rowsUpserted).toBe(1);
      expect(summary.rowsZeroed).toBe(0);
    });

    it('reports rowsZeroed=1 when an existing product disappears', async () => {
      const existingRow = makeStockRow('disappeared-card', { priceCents: 500, quantity: 3 });
      (stockRepo.find as jest.Mock).mockResolvedValue([existingRow]);
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([]));
      // 1 zero-out / 1 existing = 100% delta — bypass guard via first-run exemption.
      (runRepo.count as jest.Mock).mockResolvedValue(0);

      const summary = await service.runScrape('cupula-dt');

      expect(summary.rowsUpserted).toBe(0);
      expect(summary.rowsZeroed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Delta guard
  // ---------------------------------------------------------------------------

  describe('delta guard', () => {
    it('pauses run when delta exceeds 90% and completed runs exist', async () => {
      // 10 existing rows, all will disappear → 100% delta
      const existing = Array.from({ length: 10 }, (_, i) => makeStockRow(`card-${i}`));
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null);
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 3 }));
      (stockRepo.find as jest.Mock).mockResolvedValue(existing);

      // Scraper returns nothing — all existing rows will be zeroed
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([]));

      // Has 1 completed run — guard applies
      (runRepo.count as jest.Mock).mockResolvedValue(1);

      const summary = await service.runScrape('cupula-dt');

      expect(summary.rowsUpserted).toBe(0);
      expect(summary.rowsZeroed).toBe(0); // nothing persisted
      expect(summary.deltaPercent).toBe(100);

      // Run should be marked paused_delta_guard
      const updateCall = (runRepo.update as jest.Mock).mock.calls.find(
        (call: [unknown, { status?: EStoreScrapeRunStatus }]) =>
          (call[1] as { status: EStoreScrapeRunStatus }).status === EStoreScrapeRunStatus.PausedDeltaGuard,
      );
      expect(updateCall).toBeDefined();

      // Transaction should NOT have been called (no DB writes)
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('applies first-run exemption (no completed runs in history)', async () => {
      const existing = Array.from({ length: 10 }, (_, i) => makeStockRow(`card-${i}`));
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null);
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 4 }));
      (stockRepo.find as jest.Mock).mockResolvedValue(existing);
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([]));

      // Zero completed runs → first-run exemption
      (runRepo.count as jest.Mock).mockResolvedValue(0);

      const summary = await service.runScrape('cupula-dt');

      // Should complete normally (all zeroed, no upserts)
      expect(summary.rowsZeroed).toBe(10);

      const updateCall = (runRepo.update as jest.Mock).mock.calls.find(
        (call: [unknown, { status?: EStoreScrapeRunStatus }]) =>
          (call[1] as { status: EStoreScrapeRunStatus }).status === EStoreScrapeRunStatus.Completed,
      );
      expect(updateCall).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('marks run as failed and re-throws when scraper throws', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null);
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 7 }));

      const scraperError = new Error('PARSE_FAILED: fetch failed');
      // Return an async generator that immediately throws
      async function* failingStream(): AsyncGenerator<IScrapedProduct> {
        throw scraperError;
        yield {} as IScrapedProduct;
      }
      (scraper.scrapeStore as jest.Mock).mockReturnValue(failingStream());

      await expect(service.runScrape('cupula-dt')).rejects.toThrow('PARSE_FAILED: fetch failed');

      const failedUpdate = (runRepo.update as jest.Mock).mock.calls.find(
        (call: [unknown, { status?: EStoreScrapeRunStatus }]) =>
          (call[1] as { status: EStoreScrapeRunStatus }).status === EStoreScrapeRunStatus.Failed,
      );
      expect(failedUpdate).toBeDefined();
      expect(
        (failedUpdate as [unknown, { errorMessage: string }])[1].errorMessage,
      ).toBe('PARSE_FAILED: fetch failed');

      // No transaction writes
      expect(transactionMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Duplicate product de-duplication
  // ---------------------------------------------------------------------------

  describe('duplicate product handling', () => {
    it('prefers higher quantity when the same cardIdentifier appears twice', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null);
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 8 }));
      (stockRepo.find as jest.Mock).mockResolvedValue([]);
      (runRepo.count as jest.Mock).mockResolvedValue(0);

      const products: IScrapedProduct[] = [
        { rawName: 'Dup Card', priceCents: 500, quantity: 3, productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1' },
        { rawName: 'Dup Card', priceCents: 400, quantity: 7, productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=2' },
      ];
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream(products));
      (matcher.match as jest.Mock).mockResolvedValue([{
        cardIdentifier: 'dup-card',
        source: 'deterministic',
      }]);

      const summary = await service.runScrape('cupula-dt');

      // Both match → one upsert (de-duped to higher quantity row)
      expect(summary.productsMatched).toBe(2);
      expect(summary.rowsUpserted).toBe(1);
    });

    it('prefers lower price on quantity tie', async () => {
      (storeRepo.findOne as jest.Mock).mockResolvedValue(makeStore());
      (runRepo.findOne as jest.Mock).mockResolvedValue(null);
      (runRepo.save as jest.Mock).mockResolvedValue(makeRun({ id: 9 }));
      (stockRepo.find as jest.Mock).mockResolvedValue([]);
      (runRepo.count as jest.Mock).mockResolvedValue(0);

      // To verify which row "won" we capture the transaction call values.
      const capturedValues: unknown[] = [];
      transactionMock.mockImplementationOnce(
        (cb: (em: {
          createQueryBuilder: () => {
            insert: () => {
              into: () => {
                values: (v: unknown) => {
                  orUpdate: () => { execute: jest.Mock };
                };
              };
            };
            update: () => { set: () => { where: () => { execute: jest.Mock } } };
          };
        }) => Promise<void>) =>
          cb({
            createQueryBuilder: () => ({
              insert: () => ({
                into: () => ({
                  values: (v: unknown) => {
                    capturedValues.push(v);
                    return { orUpdate: () => ({ execute: jest.fn().mockResolvedValue(undefined) }) };
                  },
                }),
              }),
              update: () => ({
                set: () => ({
                  where: () => ({ execute: jest.fn().mockResolvedValue(undefined) }),
                }),
              }),
            }),
          }),
      );

      const products: IScrapedProduct[] = [
        { rawName: 'Dup Card', priceCents: 500, quantity: 5, productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1' },
        { rawName: 'Dup Card', priceCents: 300, quantity: 5, productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=2' },
      ];
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream(products));
      (matcher.match as jest.Mock).mockResolvedValue([{
        cardIdentifier: 'dup-card',
        source: 'deterministic',
      }]);

      await service.runScrape('cupula-dt');

      // The lower-priced row (300) should have been selected.
      const upsertedRow = capturedValues[0] as { priceCents: number };
      expect(upsertedRow.priceCents).toBe(300);
    });
  });
});

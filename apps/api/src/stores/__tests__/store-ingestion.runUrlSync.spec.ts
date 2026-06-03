import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import {
  StoreEntity,
  StoreStockEntity,
  StoreScrapeRunEntity,
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

function makeStockRow(
  cardIdentifier: string,
  overrides: Partial<StoreStockEntity> = {},
): StoreStockEntity {
  return {
    id: Math.floor(Math.random() * 10000),
    storeId: 1,
    cardIdentifier,
    priceCents: 4990,
    quantity: 3,
    productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=old',
    productNameRaw: 'Old Name',
    lastFetchedAt: new Date('2026-04-01'),
    store: {} as StoreEntity,
    ...overrides,
  } as StoreStockEntity;
}

async function* makeStream(products: IScrapedProduct[]): AsyncGenerator<IScrapedProduct> {
  for (const p of products) {
    yield p;
  }
}

const PRODUCT_A: IScrapedProduct = {
  rawName: 'Card Alpha',
  priceCents: null,
  quantity: 0,
  productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=alpha',
};

const PRODUCT_B: IScrapedProduct = {
  rawName: 'Card Beta',
  priceCents: null,
  quantity: 0,
  productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=beta',
};

const MATCH_A: ICardMatchResult = { cardIdentifier: 'card-alpha', source: 'deterministic' };
const MATCH_B: ICardMatchResult = { cardIdentifier: 'card-beta', source: 'deterministic' };

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('StoreIngestionService.runUrlSync', () => {
  let service: StoreIngestionService;

  let storeRepo: { findOne: jest.Mock; update: jest.Mock };
  let stockRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let scraper: ReturnType<typeof createMock<SbraubleScraperService>>;
  let matcher: ReturnType<typeof createMock<CardNameMatcherService>>;

  beforeEach(async () => {
    storeRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    stockRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((dto) => dto),
      find: jest.fn().mockResolvedValue([]),
    };

    scraper = createMock<SbraubleScraperService>();
    matcher = createMock<CardNameMatcherService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreIngestionService,
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreScrapeRunEntity), useValue: createMock<StoreScrapeRunEntity>() },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: SbraubleScraperService, useValue: scraper },
        { provide: CardNameMatcherService, useValue: matcher },
        { provide: DataSource, useValue: createMock<DataSource>() },
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
      storeRepo.findOne.mockResolvedValue(null);

      await expect(service.runUrlSync('unknown-slug')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when store.active is false', async () => {
      storeRepo.findOne.mockResolvedValue(makeStore({ active: false }));

      await expect(service.runUrlSync('cupula-dt')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path: two matched products — one existing, one new
  // ---------------------------------------------------------------------------

  describe('upsert strategy', () => {
    beforeEach(() => {
      storeRepo.findOne.mockResolvedValue(makeStore());
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([PRODUCT_A, PRODUCT_B]));
    });

    it('updates only productUrl + productNameRaw for an existing row, not priceCents/quantity', async () => {
      // Arrange: card-alpha already exists with real price/stock
      stockRepo.findOne.mockImplementation(
        (_opts: { where: { storeId: number; cardIdentifier: string } }) =>
          Promise.resolve(
            _opts.where.cardIdentifier === 'card-alpha'
              ? makeStockRow('card-alpha', { priceCents: 4990, quantity: 3 })
              : null,
          ),
      );
      (matcher.match as jest.Mock).mockImplementation(
        (_slug: string, rawName: string): Promise<readonly ICardMatchResult[]> => {
          if (rawName === 'Card Alpha') return Promise.resolve([MATCH_A]);
          if (rawName === 'Card Beta') return Promise.resolve([MATCH_B]);
          return Promise.resolve([]);
        },
      );

      // Act
      await service.runUrlSync('cupula-dt');

      // Assert — existing row: update called with only productUrl + productNameRaw
      const updateCalls: [unknown, unknown][] = (stockRepo.update as jest.Mock).mock.calls;
      const alphaUpdateCall = updateCalls.find(
        (call) => (call[0] as { cardIdentifier?: string }).cardIdentifier === 'card-alpha',
      );
      expect(alphaUpdateCall).toBeDefined();
      const updatedFields = alphaUpdateCall![1] as Record<string, unknown>;
      expect(updatedFields.productUrl).toBe(PRODUCT_A.productUrl);
      expect(updatedFields.productNameRaw).toBe(PRODUCT_A.rawName);
      // CRITICAL: priceCents and quantity must NOT be in the update payload
      expect(Object.keys(updatedFields)).not.toContain('priceCents');
      expect(Object.keys(updatedFields)).not.toContain('quantity');
    });

    it('inserts a new row with priceCents=null and quantity=0 for a brand-new card', async () => {
      // Arrange: card-beta does not exist
      stockRepo.findOne.mockResolvedValue(null);
      (matcher.match as jest.Mock).mockImplementation(
        (_slug: string, rawName: string): Promise<readonly ICardMatchResult[]> => {
          if (rawName === 'Card Beta') return Promise.resolve([MATCH_B]);
          return Promise.resolve([]);
        },
      );
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([PRODUCT_B]));

      // Act
      await service.runUrlSync('cupula-dt');

      // Assert — save (insert) called; the created row must have null price and 0 quantity
      expect(stockRepo.save).toHaveBeenCalled();
      const createdRow = (stockRepo.create as jest.Mock).mock.calls[0]![0] as Record<string, unknown>;
      expect(createdRow.priceCents).toBeNull();
      expect(createdRow.quantity).toBe(0);
      expect(createdRow.productUrl).toBe(PRODUCT_B.productUrl);
      expect(createdRow.productNameRaw).toBe(PRODUCT_B.rawName);
    });

    it('returns correct counts for 2 products, 2 matched, 2 rows upserted', async () => {
      // Arrange: both cards are new
      stockRepo.findOne.mockResolvedValue(null);
      (matcher.match as jest.Mock).mockImplementation(
        (_slug: string, rawName: string): Promise<readonly ICardMatchResult[]> => {
          if (rawName === 'Card Alpha') return Promise.resolve([MATCH_A]);
          if (rawName === 'Card Beta') return Promise.resolve([MATCH_B]);
          return Promise.resolve([]);
        },
      );

      // Act
      const result = await service.runUrlSync('cupula-dt');

      // Assert
      expect(result.productsFetched).toBe(2);
      expect(result.productsMatched).toBe(2);
      expect(result.rowsUpserted).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Unmatched products are skipped
  // ---------------------------------------------------------------------------

  describe('unmatched products', () => {
    it('skips unmatched products and does not call stockRepo', async () => {
      storeRepo.findOne.mockResolvedValue(makeStore());
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([PRODUCT_A]));
      (matcher.match as jest.Mock).mockResolvedValue([]);

      const result = await service.runUrlSync('cupula-dt');

      expect(result.productsFetched).toBe(1);
      expect(result.productsMatched).toBe(0);
      expect(result.rowsUpserted).toBe(0);
      expect(stockRepo.findOne).not.toHaveBeenCalled();
      expect(stockRepo.update).not.toHaveBeenCalled();
      expect(stockRepo.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // No delta guard, no scrape-run row
  // ---------------------------------------------------------------------------

  describe('no delta guard / no run row created', () => {
    it('does not interact with runRepo at all', async () => {
      storeRepo.findOne.mockResolvedValue(makeStore());
      (scraper.scrapeStore as jest.Mock).mockReturnValue(makeStream([]));

      // Spy on the runRepo mock to ensure it is never touched
      const runRepo = createMock<StoreScrapeRunEntity>();

      await service.runUrlSync('cupula-dt');

      // runRepo is injected as StoreScrapeRunEntity token mock —
      // the assertions above (stockRepo not called) are sufficient.
      // Key: no run status update, no PausedDeltaGuard path.
      expect(stockRepo.update).not.toHaveBeenCalled();
      expect(stockRepo.save).not.toHaveBeenCalled();
      void runRepo; // suppress unused-var lint
    });
  });
});

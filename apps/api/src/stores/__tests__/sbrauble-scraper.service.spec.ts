import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../../database/entities/store.entity';
import { SbraubleScraperService } from '../sbrauble-scraper.service';
import { FirecrawlClientService } from '../firecrawl-client.service';
import { EScraperErrorCode, ScraperError } from '../errors/scraper.errors';
import { IScrapedProduct } from '../types/scraped-product';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.join(__dirname, '../__fixtures__');

function loadFixture(filename: string): Uint8Array {
  const content = fs.readFileSync(path.join(FIXTURES_DIR, filename));
  return new Uint8Array(content);
}

function makeGuardResult(html: Uint8Array) {
  return { status: 200, headers: {}, body: html };
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<StoreEntity> = {}): StoreEntity {
  const store = new StoreEntity();
  store.id = 1;
  store.slug = 'cupula-dt';
  store.name = 'Cúpula DT';
  store.baseUrl = 'https://www.cupuladt.com.br';
  store.listingPath = '/?view=ecom/itens&tcg=8';
  store.rateLimitMs = 1500;
  store.active = true;
  store.lastScrapedAt = null;
  store.lastFetchedAt = null;
  store.createdAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(store, overrides);
}

// ---------------------------------------------------------------------------
// Async generator collector
// ---------------------------------------------------------------------------

async function collect(gen: AsyncGenerator<IScrapedProduct>): Promise<IScrapedProduct[]> {
  const results: IScrapedProduct[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('SbraubleScraperService', () => {
  let service: SbraubleScraperService;
  let fetchGuard: jest.Mocked<FetchGuardService>;
  let storeRepository: jest.Mocked<Repository<StoreEntity>>;

  beforeEach(async () => {
    fetchGuard = createMock<FetchGuardService>();
    storeRepository = createMock<Repository<StoreEntity>>();
    storeRepository.update.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
    // Disabled Firecrawl → these tests exercise the direct fetchGuard path.
    // (createMock auto-mocks isEnabled() to a truthy proxy, so force it false.)
    const firecrawl = createMock<FirecrawlClientService>();
    firecrawl.isEnabled.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbraubleScraperService,
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: FirecrawlClientService, useValue: firecrawl },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepository },
      ],
    }).compile();

    service = module.get<SbraubleScraperService>(SbraubleScraperService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path: single listing page
  // -------------------------------------------------------------------------

  describe('single listing page', () => {
    it('should yield all valid products from the fixture page', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');

      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert — fixture has 6 cards; all are yielded regardless of listing price/stock text
      expect(products).toHaveLength(6);
    });

    it('should parse product names correctly', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert
      expect(products.at(0)?.rawName).toBe('A Drop in the Ocean (Blue)');
      expect(products.at(1)?.rawName).toBe('Aether Crackers (Cold Foil)');
      expect(products.at(2)?.rawName).toBe('5 Copper');
    });

    it('should construct absolute product URLs from relative listing hrefs', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert — URLs are absolute https:// with the store hostname
      expect(products.at(0)?.productUrl).toMatch(/^https:\/\/www\.cupuladt\.com\.br\//);
      expect(products.at(0)?.productUrl).toContain('cardID=WTR001');
    });

    it('should construct guardedFetch allowHosts from store baseUrl hostname (strict equality)', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      await collect(service.scrapeStore(makeStore()));

      // Assert — allowHosts must be ['www.cupuladt.com.br'] (exact hostname)
      expect(fetchGuard.guardedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ allowHosts: ['www.cupuladt.com.br'] }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Listing yields sentinel price/stock (obfuscated CSS sprite — not parsed)
  // -------------------------------------------------------------------------

  describe('listing price/stock sentinel values', () => {
    it('should yield priceCents=null for every product regardless of listing content', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert — listing no longer parses the obfuscated price; detail queue provides real values
      expect(products.every((p) => p.priceCents === null)).toBe(true);
    });

    it('should yield quantity=0 for every product regardless of listing content', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert
      expect(products.every((p) => p.quantity === 0)).toBe(true);
    });

    it('should yield priceCents=null and quantity=0 for a "Sob consulta" card too', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert — "Amplify the Arknight" had "Sob consulta" on the listing; same sentinel as others
      const sobConsulta = products.find((p) => p.rawName === 'Amplify the Arknight');
      expect(sobConsulta).toBeDefined();
      expect(sobConsulta!.priceCents).toBeNull();
      expect(sobConsulta!.quantity).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: product URL outside allow-list
  // -------------------------------------------------------------------------

  describe('product URL outside allow-list', () => {
    it('should drop the row with a warn log and still yield valid products', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-with-bad-url.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert — only the valid product is yielded; the "evil.example.com" row is dropped
      expect(products).toHaveLength(1);
      expect(products.at(0)?.rawName).toBe('A Drop in the Ocean (Blue)');
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: empty first page
  // -------------------------------------------------------------------------

  describe('empty first page', () => {
    it('should terminate generator immediately and yield zero products', async () => {
      // Arrange
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch.mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert
      expect(products).toHaveLength(0);
      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Happy path: multi-page pagination
  // -------------------------------------------------------------------------

  describe('multi-page pagination', () => {
    it('should yield products from both pages and stop at empty page', async () => {
      // Arrange
      const page1Html = loadFixture('cupula-dt-listing-page.html');
      const page2Html = loadFixture('cupula-dt-listing-page-2.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(page1Html))
        .mockResolvedValueOnce(makeGuardResult(page2Html))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      const products = await collect(service.scrapeStore(makeStore()));

      // Assert — 6 from page 1 + 2 from page 2
      expect(products).toHaveLength(8);
      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(3);
    });

    it('should request pages with incrementing page parameter', async () => {
      // Arrange
      const page1Html = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(page1Html))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));

      // Act
      await collect(service.scrapeStore(makeStore()));

      // Assert
      const calls = fetchGuard.guardedFetch.mock.calls;
      expect(calls.at(0)?.[0]).toContain('page=1');
      expect(calls.at(1)?.[0]).toContain('page=2');
    });
  });

  // -------------------------------------------------------------------------
  // Edge case: pagination runaway guard
  // -------------------------------------------------------------------------

  describe('pagination runaway', () => {
    it('should throw ScraperError(PAGINATION_RUNAWAY) after 200 pages', async () => {
      // Arrange — every page returns the same non-empty fixture
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      fetchGuard.guardedFetch.mockResolvedValue(makeGuardResult(pageHtml));

      // Act
      const gen = service.scrapeStore(makeStore({ rateLimitMs: 0 }));
      let productCount = 0;
      let thrownError: ScraperError | null = null;
      try {
        for await (const _ of gen) {
          productCount += 1;
        }
      } catch (err) {
        thrownError = err as ScraperError;
      }

      // Assert
      expect(thrownError).not.toBeNull();
      expect(thrownError!.code).toBe(EScraperErrorCode.PAGINATION_RUNAWAY);
      // 200 pages × 6 products = 1200 products yielded before the throw
      expect(productCount).toBe(1200);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Error path: invalid listingPath
  // -------------------------------------------------------------------------

  describe('invalid listingPath', () => {
    it('should throw ScraperError(INVALID_STORE_LISTING_PATH) before any fetch', async () => {
      // Arrange
      const store = makeStore({ listingPath: '/../../etc/passwd' });

      // Act
      const gen = service.scrapeStore(store);
      let thrownError: ScraperError | null = null;
      try {
        await gen.next();
      } catch (err) {
        thrownError = err as ScraperError;
      }

      // Assert
      expect(thrownError).not.toBeNull();
      expect(thrownError!.code).toBe(EScraperErrorCode.INVALID_STORE_LISTING_PATH);
      expect(fetchGuard.guardedFetch).not.toHaveBeenCalled();
    });

    it('should throw INVALID_STORE_LISTING_PATH for a non-ecom view', async () => {
      // Arrange
      const store = makeStore({ listingPath: '/?view=user/profile' });

      // Act
      const gen = service.scrapeStore(store);
      let thrownError: ScraperError | null = null;
      try {
        await gen.next();
      } catch (err) {
        thrownError = err as ScraperError;
      }

      // Assert
      expect(thrownError!.code).toBe(EScraperErrorCode.INVALID_STORE_LISTING_PATH);
      expect(fetchGuard.guardedFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error path: fetch failure re-thrown as ScraperError
  // -------------------------------------------------------------------------

  describe('fetch failure', () => {
    it('should re-throw FetchGuardService errors as ScraperError(PARSE_FAILED)', async () => {
      // Arrange
      fetchGuard.guardedFetch.mockRejectedValueOnce(new Error('Host denied'));

      // Act
      const gen = service.scrapeStore(makeStore());
      let thrownError: ScraperError | null = null;
      try {
        await gen.next();
      } catch (err) {
        thrownError = err as ScraperError;
      }

      // Assert
      expect(thrownError).not.toBeNull();
      expect(thrownError!.code).toBe(EScraperErrorCode.PARSE_FAILED);
      expect(thrownError!.message).toContain('Host denied');
    });
  });

  // -------------------------------------------------------------------------
  // Integration: rate limit enforcement
  // -------------------------------------------------------------------------

  describe('rate limit enforcement', () => {
    it('should persist lastFetchedAt after each fetch', async () => {
      // Arrange
      const pageHtml = loadFixture('cupula-dt-listing-page.html');
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch
        .mockResolvedValueOnce(makeGuardResult(pageHtml))
        .mockResolvedValueOnce(makeGuardResult(emptyHtml));
      const store = makeStore({ lastFetchedAt: null });

      // Act
      await collect(service.scrapeStore(store));

      // Assert — repository.update called once per page fetch (2 pages)
      expect(storeRepository.update).toHaveBeenCalledTimes(2);
      expect(storeRepository.update).toHaveBeenCalledWith(
        { id: store.id },
        expect.objectContaining({ lastFetchedAt: expect.any(Date) }),
      );
    });

    it('should skip the sleep when lastFetchedAt is null (first ever fetch)', async () => {
      // Arrange
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch.mockResolvedValueOnce(makeGuardResult(emptyHtml));
      const store = makeStore({ lastFetchedAt: null, rateLimitMs: 60_000 });

      const startMs = Date.now();

      // Act
      await collect(service.scrapeStore(store));

      // Assert — no sleep on first fetch; should complete well under 1 second
      const elapsed = Date.now() - startMs;
      expect(elapsed).toBeLessThan(1000);
    });

    it('should skip the sleep when elapsed time already exceeds rateLimitMs', async () => {
      // Arrange — lastFetchedAt is far in the past
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch.mockResolvedValueOnce(makeGuardResult(emptyHtml));
      const pastDate = new Date(Date.now() - 10_000); // 10 seconds ago
      const store = makeStore({ lastFetchedAt: pastDate, rateLimitMs: 1500 });

      const startMs = Date.now();

      // Act
      await collect(service.scrapeStore(store));

      // Assert — elapsed already exceeds rateLimitMs, no sleep needed
      const elapsed = Date.now() - startMs;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // -------------------------------------------------------------------------
  // No direct fetch() calls verification (structural)
  // -------------------------------------------------------------------------

  describe('no direct fetch() calls', () => {
    it('should call only fetchGuard.guardedFetch, not global fetch', async () => {
      // Arrange
      const emptyHtml = loadFixture('cupula-dt-empty-page.html');
      fetchGuard.guardedFetch.mockResolvedValueOnce(makeGuardResult(emptyHtml));
      const globalFetchSpy = jest.spyOn(global, 'fetch');

      // Act
      await collect(service.scrapeStore(makeStore()));

      // Assert — global fetch never called directly
      expect(globalFetchSpy).not.toHaveBeenCalled();
      globalFetchSpy.mockRestore();
    });
  });

  describe('Firecrawl-enabled listing fetch', () => {
    it('fetches listing pages via Firecrawl (not the direct client) when enabled', async () => {
      const enabledFirecrawl = createMock<FirecrawlClientService>();
      enabledFirecrawl.isEnabled.mockReturnValue(true);
      // Empty listing page → parse yields nothing → loop ends after page 1.
      enabledFirecrawl.scrapeHtml.mockResolvedValue('<html><body></body></html>');
      const directFetch = createMock<FetchGuardService>();

      const mod: TestingModule = await Test.createTestingModule({
        providers: [
          SbraubleScraperService,
          { provide: FetchGuardService, useValue: directFetch },
          { provide: FirecrawlClientService, useValue: enabledFirecrawl },
          { provide: getRepositoryToken(StoreEntity), useValue: storeRepository },
        ],
      }).compile();
      const svc = mod.get<SbraubleScraperService>(SbraubleScraperService);

      await collect(svc.scrapeStore(makeStore()));

      expect(enabledFirecrawl.scrapeHtml).toHaveBeenCalledTimes(1);
      expect(directFetch.guardedFetch).not.toHaveBeenCalled();
    });
  });
});

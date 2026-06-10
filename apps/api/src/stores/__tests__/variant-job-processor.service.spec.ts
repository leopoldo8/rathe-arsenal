import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { VariantJobProcessorService } from '../variant-job-processor.service';
import { VariantFetchQueueService } from '../variant-fetch-queue.service';
import { SbraubleDetailParserService } from '../sbrauble-detail-parser.service';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { VariantFetchJobEntity, EVariantFetchJobStatus } from '../../database/entities/variant-fetch-job.entity';
import { EScraperErrorCode, ScraperError } from '../errors/scraper.errors';
import { FirecrawlClientService } from '../firecrawl-client.service';

// createMock auto-mocks isEnabled() to a truthy proxy; force it false so these
// tests exercise the direct-fetch path.
function disabledFirecrawl(): ReturnType<typeof createMock<FirecrawlClientService>> {
  const m = createMock<FirecrawlClientService>();
  m.isEnabled.mockReturnValue(false);
  return m;
}

describe('VariantJobProcessorService', () => {
  it('derives and upserts store_stock from parsed variants and marks the card done', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    fetchGuard.guardedFetch.mockResolvedValue({ status: 200, headers: {}, body: new Uint8Array(Buffer.from('<html></html>')) } as never);
    const parser = createMock<SbraubleDetailParserService>();
    parser.parseDetailPage.mockReturnValue([
      { edition: 'PEN', condition: 'NM', finish: 'non-foil', priceCents: 300, quantity: 2 },
      { edition: 'PEN', condition: 'NM', finish: 'foil', priceCents: 100, quantity: 1 },
    ]);
    const storeRepo = createMock<Repository<StoreEntity>>();
    storeRepo.findOne.mockResolvedValue({ id: 1, slug: 'cupula-dt', baseUrl: 'https://www.cupuladt.com.br', lastFetchedAt: null, rateLimitMs: 0 } as never);
    const stockRepo = createMock<Repository<StoreStockEntity>>();
    const queue = createMock<VariantFetchQueueService>();
    const dataSource = createMock<DataSource>();
     
    (dataSource.transaction as jest.Mock).mockImplementation((fn: (em: unknown) => Promise<unknown>) => fn(createMock()));

    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantJobProcessorService,
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: SbraubleDetailParserService, useValue: parser },
        { provide: VariantFetchQueueService, useValue: queue },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: FirecrawlClientService, useValue: disabledFirecrawl() },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    const processor = moduleRef.get(VariantJobProcessorService);

    const job = { id: 'job-1', storeId: 1, status: EVariantFetchJobStatus.Running, cards: [{ cardIdentifier: 'a-red', status: 'pending' }] } as VariantFetchJobEntity;
    await processor.process(job, [{ cardIdentifier: 'a-red', productUrl: 'https://www.cupuladt.com.br/x', listingPriceCents: null, listingQuantity: 0 }]);

    expect(stockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 1, cardIdentifier: 'a-red', priceCents: 100, quantity: 3 }),
      expect.anything(),
    );
    expect(queue.markCardResult).toHaveBeenCalledWith('job-1', 'a-red', true);
  });

  it('marks a card failed and still finishes the job when its fetch throws', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    fetchGuard.guardedFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ status: 200, headers: {}, body: new Uint8Array(Buffer.from('<html></html>')) } as never);
    const parser = createMock<SbraubleDetailParserService>();
    parser.parseDetailPage.mockReturnValue([
      { edition: 'PEN', condition: 'NM', finish: 'non-foil', priceCents: 200, quantity: 4 },
    ]);
    const storeRepo = createMock<Repository<StoreEntity>>();
    storeRepo.findOne.mockResolvedValue({ id: 1, slug: 'cupula-dt', baseUrl: 'https://www.cupuladt.com.br', lastFetchedAt: null, rateLimitMs: 0 } as never);
    const stockRepo = createMock<Repository<StoreStockEntity>>();
    const queue = createMock<VariantFetchQueueService>();
    const dataSource = createMock<DataSource>();
     
    (dataSource.transaction as jest.Mock).mockImplementation((fn: (em: unknown) => Promise<unknown>) => fn(createMock()));

    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantJobProcessorService,
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: SbraubleDetailParserService, useValue: parser },
        { provide: VariantFetchQueueService, useValue: queue },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: FirecrawlClientService, useValue: disabledFirecrawl() },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    const processor = moduleRef.get(VariantJobProcessorService);

    const job = { id: 'job-1', storeId: 1, status: EVariantFetchJobStatus.Running, cards: [
      { cardIdentifier: 'bad-red', status: 'pending' },
      { cardIdentifier: 'good-red', status: 'pending' },
    ] } as VariantFetchJobEntity;
    await processor.process(job, [
      { cardIdentifier: 'bad-red', productUrl: 'https://www.cupuladt.com.br/bad', listingPriceCents: null, listingQuantity: 0 },
      { cardIdentifier: 'good-red', productUrl: 'https://www.cupuladt.com.br/good', listingPriceCents: null, listingQuantity: 0 },
    ]);

    // The failing card is marked failed, the loop continues to the next card,
    // which succeeds, and the job is finished exactly once.
    expect(queue.markCardResult).toHaveBeenCalledWith('job-1', 'bad-red', false);
    expect(queue.markCardResult).toHaveBeenCalledWith('job-1', 'good-red', true);
    expect(queue.finish).toHaveBeenCalledTimes(1);
    expect(queue.finish).toHaveBeenCalledWith('job-1', null);
  });

  it('finishes the job with a blocked error when every card hits a block page', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    fetchGuard.guardedFetch.mockResolvedValue({ status: 200, headers: {}, body: new Uint8Array(Buffer.from('<html></html>')) } as never);
    const parser = createMock<SbraubleDetailParserService>();
    // Every card's detail page is a block page → parser throws.
    parser.parseDetailPage.mockImplementation(() => {
      throw new ScraperError(EScraperErrorCode.DETAIL_PAGE_BLOCKED_OR_EMPTY, 'blocked');
    });
    const storeRepo = createMock<Repository<StoreEntity>>();
    storeRepo.findOne.mockResolvedValue({ id: 1, slug: 'cupula-dt', baseUrl: 'https://www.cupuladt.com.br', lastFetchedAt: null, rateLimitMs: 0 } as never);
    const stockRepo = createMock<Repository<StoreStockEntity>>();
    const queue = createMock<VariantFetchQueueService>();
    const dataSource = createMock<DataSource>();
    (dataSource.transaction as jest.Mock).mockImplementation((fn: (em: unknown) => Promise<unknown>) => fn(createMock()));

    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantJobProcessorService,
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: SbraubleDetailParserService, useValue: parser },
        { provide: VariantFetchQueueService, useValue: queue },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: FirecrawlClientService, useValue: disabledFirecrawl() },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    const processor = moduleRef.get(VariantJobProcessorService);

    const job = { id: 'job-2', storeId: 1, status: EVariantFetchJobStatus.Running, cards: [{ cardIdentifier: 'a-red', status: 'pending' }] } as VariantFetchJobEntity;
    await processor.process(job, [{ cardIdentifier: 'a-red', productUrl: 'https://www.cupuladt.com.br/x', listingPriceCents: null, listingQuantity: 0 }]);

    // Card marked failed; the store_stock row is NOT overwritten with null
    // (a transient block must not destroy good price data); job finishes Failed.
    expect(queue.markCardResult).toHaveBeenCalledWith('job-2', 'a-red', false);
    expect(stockRepo.upsert).not.toHaveBeenCalled();
    expect(queue.finish).toHaveBeenCalledTimes(1);
    const finishArg = (queue.finish as jest.Mock).mock.calls[0][1];
    expect(finishArg).toMatch(/unreachable|blocked/i);
  });

  it('fetches via Firecrawl (not the direct client) when Firecrawl is enabled', async () => {
    const fetchGuard = createMock<FetchGuardService>();
    const parser = createMock<SbraubleDetailParserService>();
    parser.parseDetailPage.mockReturnValue([
      { edition: 'PEN', condition: 'NM', finish: 'non-foil', priceCents: 500, quantity: 2 },
    ]);
    const firecrawl = createMock<FirecrawlClientService>();
    firecrawl.isEnabled.mockReturnValue(true);
    firecrawl.scrapeHtml.mockResolvedValue('<div class="table-cards-row">...</div>');
    const storeRepo = createMock<Repository<StoreEntity>>();
    storeRepo.findOne.mockResolvedValue({ id: 1, slug: 'cupula-dt', baseUrl: 'https://www.cupuladt.com.br', lastFetchedAt: null, rateLimitMs: 0 } as never);
    const stockRepo = createMock<Repository<StoreStockEntity>>();
    const queue = createMock<VariantFetchQueueService>();
    const dataSource = createMock<DataSource>();
    (dataSource.transaction as jest.Mock).mockImplementation((fn: (em: unknown) => Promise<unknown>) => fn(createMock()));

    const moduleRef = await Test.createTestingModule({
      providers: [
        VariantJobProcessorService,
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: SbraubleDetailParserService, useValue: parser },
        { provide: VariantFetchQueueService, useValue: queue },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreStockEntity), useValue: stockRepo },
        { provide: FirecrawlClientService, useValue: firecrawl },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    const processor = moduleRef.get(VariantJobProcessorService);

    const job = { id: 'job-3', storeId: 1, status: EVariantFetchJobStatus.Running, cards: [{ cardIdentifier: 'a-red', status: 'pending' }] } as VariantFetchJobEntity;
    await processor.process(job, [{ cardIdentifier: 'a-red', productUrl: 'https://www.cupuladt.com.br/x', listingPriceCents: null, listingQuantity: 0 }]);

    expect(firecrawl.scrapeHtml).toHaveBeenCalledWith('https://www.cupuladt.com.br/x');
    expect(fetchGuard.guardedFetch).not.toHaveBeenCalled();
    expect(queue.markCardResult).toHaveBeenCalledWith('job-3', 'a-red', true);
  });
});

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

const FIXTURES_DIR = path.join(__dirname, '../__fixtures__');

function fixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
}

const EDITIONS_PAGE = fixture('cupula-dt-editions-page.html');
const LISTING_PAGE = fixture('cupula-dt-listing-page.html');
const LISTING_PAGE_2 = fixture('cupula-dt-listing-page-2.html');
const LISTING_WITH_BAD_URL = fixture('cupula-dt-listing-with-bad-url.html');
const NO_RESULTS_PAGE = fixture('cupula-dt-empty-page.html');
const PAGINATION_CAP_PAGE = fixture('cupula-dt-pagination-cap-page.html');
const CHALLENGE_PAGE = '<html><body><h1>Just a moment...</h1></body></html>';

function editionsPage(editionIds: readonly string[]): string {
  const links = editionIds
    .map((id) => `<li><a href="./?view=ecom/itens&tcg=8&txt_edicao=${id}"><span>Set ${id}</span></a></li>`)
    .join('');
  return `<html><body><ul class="sets_list">${links}</ul></body></html>`;
}

interface IListingPageOptions {
  readonly total: number;
  readonly cardIds: readonly string[];
  readonly rarities?: readonly string[];
}

function listingPage({ total, cardIds, rarities = ['1', '2'] }: IListingPageOptions): string {
  const rarityOptions = rarities.map((r) => `<option value='${r}'>Rarity ${r}</option>`).join('');
  const cards = cardIds
    .map(
      (id) => `<div class="card-item"><div class="card-desc"><div class="title">` +
        `<a href="/?view=ecom/item&amp;tcg=8&amp;card=${id}">Card ${id}</a></div></div></div>`,
    )
    .join('');
  return `<html><body>
    <form><select name='txt_raridade'><option value=''></option>${rarityOptions}</select>
    <select name='txt_limit'><option value='120'>120</option></select></form>
    <div class="cards"><table class='ecomresp-tab'><tr>
      <td align='left' class='textoMaior'> 1-${cardIds.length} de <b>${total.toLocaleString('en-US')}</b></td>
    </tr></table>${cards}</div>
  </body></html>`;
}

function cardIdRange(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);
}

interface IRequestedPage {
  readonly view: string | null;
  readonly edition: string | null;
  readonly rarity: string | null;
  readonly page: string | null;
  readonly limit: string | null;
  readonly inStock: string | null;
}

function toRequestedPage(url: string): IRequestedPage {
  const params = new URL(url).searchParams;
  return {
    view: params.get('view'),
    edition: params.get('txt_edicao'),
    rarity: params.get('txt_raridade'),
    page: params.get('page'),
    limit: params.get('txt_limit'),
    inStock: params.get('txt_estoque'),
  };
}

function makeStore(overrides: Partial<StoreEntity> = {}): StoreEntity {
  const store = new StoreEntity();
  store.id = 1;
  store.slug = 'cupula-dt';
  store.name = 'Cúpula DT';
  store.baseUrl = 'https://www.cupuladt.com.br';
  store.listingPath = '/?view=ecom/itens&tcg=8';
  store.rateLimitMs = 0;
  store.active = true;
  store.lastScrapedAt = null;
  store.lastFetchedAt = null;
  store.createdAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(store, overrides);
}

async function collect(gen: AsyncGenerator<IScrapedProduct>): Promise<IScrapedProduct[]> {
  const results: IScrapedProduct[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

async function collectError(gen: AsyncGenerator<IScrapedProduct>): Promise<ScraperError> {
  try {
    await collect(gen);
  } catch (err) {
    return err as ScraperError;
  }
  throw new Error('Expected the scrape to throw');
}

describe('SbraubleScraperService', () => {
  let service: SbraubleScraperService;
  let fetchGuard: jest.Mocked<FetchGuardService>;
  let storeRepository: jest.Mocked<Repository<StoreEntity>>;

  function servePages(render: (page: IRequestedPage) => string): IRequestedPage[] {
    const requested: IRequestedPage[] = [];
    fetchGuard.guardedFetch.mockImplementation(async (url: string) => {
      const page = toRequestedPage(url);
      requested.push(page);
      return { status: 200, headers: {}, body: new Uint8Array(Buffer.from(render(page))) };
    });
    return requested;
  }

  function serveEditions(editions: string, listingByEdition: Record<string, string>): IRequestedPage[] {
    return servePages((page) =>
      page.view === 'ecom/edicoesTCG' ? editions : (listingByEdition[page.edition ?? ''] ?? NO_RESULTS_PAGE),
    );
  }

  beforeEach(async () => {
    fetchGuard = createMock<FetchGuardService>();
    storeRepository = createMock<Repository<StoreEntity>>();
    storeRepository.update.mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] });
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

  describe('edition discovery', () => {
    it('reads the editions page first and searches each of the store game\'s editions once', async () => {
      const requested = serveEditions(EDITIONS_PAGE, {});

      await collect(service.scrapeStore(makeStore()));

      expect(requested.at(0)?.view).toBe('ecom/edicoesTCG');
      expect(requested.slice(1).map((p) => p.edition)).toEqual(['2', '10']);
    });

    it('searches each edition in stock only, 120 per page', async () => {
      const requested = serveEditions(EDITIONS_PAGE, {});

      await collect(service.scrapeStore(makeStore()));

      const editionSearch = requested.find((p) => p.edition === '10');
      expect(editionSearch).toEqual(
        expect.objectContaining({ view: 'ecom/itens', limit: '120', inStock: '1', page: '1', rarity: null }),
      );
    });

    it('throws EDITIONS_NOT_FOUND when the editions page lists no sets, instead of syncing nothing', async () => {
      servePages(() => editionsPage([]));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.EDITIONS_NOT_FOUND);
    });
  });

  describe('products', () => {
    it('yields the products of every edition', async () => {
      serveEditions(EDITIONS_PAGE, { '2': LISTING_PAGE, '10': LISTING_PAGE_2 });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products).toHaveLength(8);
    });

    it('yields a product listed in several editions only once', async () => {
      serveEditions(EDITIONS_PAGE, { '2': LISTING_PAGE, '10': LISTING_PAGE });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products).toHaveLength(6);
      expect(new Set(products.map((p) => p.productUrl)).size).toBe(6);
    });

    it('parses names and absolute https product URLs on the store host', async () => {
      serveEditions(EDITIONS_PAGE, { '2': LISTING_PAGE });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products.map((p) => p.rawName).slice(0, 3)).toEqual([
        'A Drop in the Ocean (Blue)',
        'Aether Crackers (Cold Foil)',
        '5 Copper',
      ]);
      expect(products.at(0)?.productUrl).toMatch(/^https:\/\/www\.cupuladt\.com\.br\//);
      expect(products.at(0)?.productUrl).toContain('cardID=WTR001');
    });

    it('yields the sentinel price and stock for every product, "Sob consulta" included', async () => {
      serveEditions(EDITIONS_PAGE, { '2': LISTING_PAGE });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products.every((p) => p.priceCents === null && p.quantity === 0)).toBe(true);
      expect(products.find((p) => p.rawName === 'Amplify the Arknight')).toBeDefined();
    });

    it('drops a product whose URL points off the store host and keeps the rest', async () => {
      serveEditions(EDITIONS_PAGE, { '2': LISTING_WITH_BAD_URL });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products.map((p) => p.rawName)).toEqual(['A Drop in the Ocean (Blue)']);
    });

    it('restricts every fetch to the store hostname', async () => {
      serveEditions(EDITIONS_PAGE, {});

      await collect(service.scrapeStore(makeStore()));

      expect(fetchGuard.guardedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ allowHosts: ['www.cupuladt.com.br'] }),
      );
    });
  });

  describe('pagination', () => {
    it('fetches exactly the pages the reported total needs', async () => {
      const requested = servePages((page) => {
        if (page.view === 'ecom/edicoesTCG') return editionsPage(['10']);
        const pageNumber = Number(page.page);
        const count = pageNumber < 3 ? 120 : 10;
        return listingPage({ total: 250, cardIds: cardIdRange(`p${pageNumber}`, count) });
      });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(requested.slice(1).map((p) => p.page)).toEqual(['1', '2', '3']);
      expect(products).toHaveLength(250);
    });

    it('treats an edition with no items in stock as empty and moves on', async () => {
      const requested = serveEditions(editionsPage(['49', '10']), { '10': LISTING_PAGE });

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products).toHaveLength(6);
      expect(requested.filter((p) => p.edition === '49')).toHaveLength(1);
    });

    it('throws PAGINATION_CAPPED when the store refuses to page further', async () => {
      servePages((page) => (page.view === 'ecom/edicoesTCG' ? editionsPage(['10']) : PAGINATION_CAP_PAGE));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.PAGINATION_CAPPED);
      expect(error.message).toContain('txt_edicao=10');
    });

    it('throws LISTING_UNRECOGNIZED for a page that is not a store listing (e.g. a bot challenge)', async () => {
      servePages((page) => (page.view === 'ecom/edicoesTCG' ? editionsPage(['10']) : CHALLENGE_PAGE));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.LISTING_UNRECOGNIZED);
      expect(error.message).toContain('Just a moment...');
    });

    it('throws LISTING_INCOMPLETE when the pages hold fewer items than the store reported', async () => {
      servePages((page) =>
        page.view === 'ecom/edicoesTCG'
          ? editionsPage(['10'])
          : listingPage({ total: 100, cardIds: cardIdRange('a', 60) }),
      );

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.LISTING_INCOMPLETE);
    });

    it('tolerates a couple of items selling out while an edition is being paged', async () => {
      servePages((page) =>
        page.view === 'ecom/edicoesTCG'
          ? editionsPage(['10'])
          : listingPage({ total: 100, cardIds: cardIdRange('a', 98) }),
      );

      const products = await collect(service.scrapeStore(makeStore()));

      expect(products).toHaveLength(98);
    });

    it('throws PAGINATION_RUNAWAY once the request budget is spent', async () => {
      const manyEditions = Array.from({ length: 700 }, (_, i) => String(i + 1));
      servePages((page) => (page.view === 'ecom/edicoesTCG' ? editionsPage(manyEditions) : NO_RESULTS_PAGE));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.PAGINATION_RUNAWAY);
    });
  });

  describe('editions too large for one search', () => {
    function largeEdition(perRarity: Record<string, { total: number; cards: number }>): (page: IRequestedPage) => string {
      return (page) => {
        if (page.view === 'ecom/edicoesTCG') return editionsPage(['10']);
        if (page.rarity === null) return listingPage({ total: 500, cardIds: cardIdRange('all', 120) });
        const segment = perRarity[page.rarity] ?? { total: 0, cards: 0 };
        return listingPage({ total: segment.total, cardIds: cardIdRange(`r${page.rarity}-p${page.page}`, segment.cards) });
      };
    }

    it('splits the edition by rarity instead of paging past the store limit', async () => {
      const requested = servePages(
        largeEdition({ '1': { total: 200, cards: 100 }, '2': { total: 300, cards: 120 } }),
      );

      const products = await collect(service.scrapeStore(makeStore()));

      const unfilteredPages = requested.filter((p) => p.view === 'ecom/itens' && p.rarity === null);
      expect(unfilteredPages.map((p) => p.page)).toEqual(['1']);
      const raritySearches = requested.filter((p) => p.rarity !== null);
      expect(raritySearches.map((p) => `${p.rarity}:${p.page}`)).toEqual(['1:1', '1:2', '2:1', '2:2', '2:3']);
      expect(products).toHaveLength(560);
    });

    it('throws PAGINATION_CAPPED when one rarity is still too large for a single search', async () => {
      servePages(largeEdition({ '1': { total: 100, cards: 100 }, '2': { total: 400, cards: 120 } }));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.PAGINATION_CAPPED);
    });

    it('throws LISTING_INCOMPLETE when the rarity segments add up to less than the edition total', async () => {
      servePages(largeEdition({ '1': { total: 100, cards: 100 }, '2': { total: 100, cards: 100 } }));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.LISTING_INCOMPLETE);
    });
  });

  describe('invalid listingPath', () => {
    it.each(['/../../etc/passwd', '/?view=user/profile'])(
      'throws INVALID_STORE_LISTING_PATH for %s before any fetch',
      async (listingPath) => {
        const error = await collectError(service.scrapeStore(makeStore({ listingPath })));

        expect(error.code).toBe(EScraperErrorCode.INVALID_STORE_LISTING_PATH);
        expect(fetchGuard.guardedFetch).not.toHaveBeenCalled();
      },
    );

    it('throws INVALID_STORE_LISTING_PATH when the path has no tcg to pick editions from', async () => {
      const error = await collectError(service.scrapeStore(makeStore({ listingPath: '/?view=ecom/itens' })));

      expect(error.code).toBe(EScraperErrorCode.INVALID_STORE_LISTING_PATH);
      expect(fetchGuard.guardedFetch).not.toHaveBeenCalled();
    });
  });

  describe('fetch failure', () => {
    it('re-throws fetch errors as ScraperError(PARSE_FAILED) with the cause', async () => {
      fetchGuard.guardedFetch.mockRejectedValueOnce(new Error('Host denied'));

      const error = await collectError(service.scrapeStore(makeStore()));

      expect(error.code).toBe(EScraperErrorCode.PARSE_FAILED);
      expect(error.message).toContain('Host denied');
    });
  });

  describe('rate limit enforcement', () => {
    it('persists lastFetchedAt after every fetch', async () => {
      const requested = serveEditions(EDITIONS_PAGE, {});
      const store = makeStore();

      await collect(service.scrapeStore(store));

      expect(storeRepository.update).toHaveBeenCalledTimes(requested.length);
      expect(storeRepository.update).toHaveBeenCalledWith(
        { id: store.id },
        expect.objectContaining({ lastFetchedAt: expect.any(Date) }),
      );
    });

    it('does not sleep before the first ever fetch', async () => {
      serveEditions(editionsPage([]), {});
      const startMs = Date.now();

      await collectError(service.scrapeStore(makeStore({ lastFetchedAt: null, rateLimitMs: 60_000 })));

      expect(Date.now() - startMs).toBeLessThan(1000);
    });

    it('does not sleep when the last fetch is older than rateLimitMs', async () => {
      serveEditions(editionsPage([]), {});
      const startMs = Date.now();

      await collectError(
        service.scrapeStore(makeStore({ lastFetchedAt: new Date(Date.now() - 10_000), rateLimitMs: 1500 })),
      );

      expect(Date.now() - startMs).toBeLessThan(1000);
    });
  });

  it('never calls global fetch directly', async () => {
    serveEditions(EDITIONS_PAGE, {});
    const globalFetchSpy = jest.spyOn(global, 'fetch');

    await collect(service.scrapeStore(makeStore()));

    expect(globalFetchSpy).not.toHaveBeenCalled();
    globalFetchSpy.mockRestore();
  });

  it('fetches every page through Firecrawl, not the direct client, when Firecrawl is enabled', async () => {
    const enabledFirecrawl = createMock<FirecrawlClientService>();
    enabledFirecrawl.isEnabled.mockReturnValue(true);
    enabledFirecrawl.scrapeHtml.mockImplementation(async (url: string) =>
      toRequestedPage(url).view === 'ecom/edicoesTCG' ? editionsPage(['10']) : NO_RESULTS_PAGE,
    );
    const directFetch = createMock<FetchGuardService>();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SbraubleScraperService,
        { provide: FetchGuardService, useValue: directFetch },
        { provide: FirecrawlClientService, useValue: enabledFirecrawl },
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepository },
      ],
    }).compile();

    await collect(mod.get(SbraubleScraperService).scrapeStore(makeStore()));

    expect(enabledFirecrawl.scrapeHtml).toHaveBeenCalledTimes(2);
    expect(directFetch.guardedFetch).not.toHaveBeenCalled();
  });
});

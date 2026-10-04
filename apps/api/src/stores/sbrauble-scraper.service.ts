import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as cheerio from 'cheerio';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../database/entities/store.entity';
import { IScrapedProduct } from './types/scraped-product';
import { EScraperErrorCode, ScraperError } from './errors/scraper.errors';
import { FirecrawlClientService } from './firecrawl-client.service';

/**
 * Whitelist regex for store.listingPath.
 *
 * Accepts paths in the form:
 *   /?view=ecom/<alphalower>(&<alphanumkey>=<alphanumval>)*
 *
 * Examples that pass:
 *   /?view=ecom/itens&tcg=8
 *   /?view=ecom/item&tcg=8&edicao=100
 *
 * Rejects anything with path traversal, arbitrary query injection, or
 * non-ecom view names. Validation happens before the first HTTP request,
 * so a compromised store row cannot redirect the scraper to an arbitrary URL.
 */
const LISTING_PATH_REGEX = /^\/\?view=ecom\/[a-z]+(&[a-zA-Z0-9]+=([a-zA-Z0-9]|%[0-9A-Fa-f]{2})+)*$/;

const MAX_REQUESTS_PER_SCRAPE = 600;
const LISTING_PAGE_SIZE = 120;
/** The store refuses to page a search past ~390 results; 3 × 120 stays under that. */
const MAX_RESULTS_PER_SEARCH = LISTING_PAGE_SIZE * 3;
const LISTING_COUNT_DRIFT_TOLERANCE = 2;
const PAGINATION_CAP_NOTICE = /limite de pagina/i;
const NO_RESULTS_NOTICE = /nenhum item encontrado/i;
const NUMERIC_ID = /^\d+$/;
const PAGE_EVIDENCE_TEXT_CHARS = 200;

/**
 * Maximum response body size per page fetch (5 MB).
 * A typical Sbrauble listing page is well under 500 KB.
 */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Timeout per HTTP request in milliseconds.
 */
const REQUEST_TIMEOUT_MS = 30_000;

interface ISearch {
  readonly edition: string;
  readonly rarity?: string;
}

interface IListingPage {
  readonly url: string;
  readonly total: number;
  readonly itemCount: number;
  readonly products: IScrapedProduct[];
  readonly rarities: string[];
}

interface IScrapeContext {
  readonly store: StoreEntity;
  readonly baseHostname: string;
  requestCount: number;
}

/**
 * Scrapes a Sbrauble-platform e-commerce store (Phase 1b: Cúpula DT only).
 *
 * Responsibilities:
 * - Validate the store's listingPath against the ecom whitelist regex.
 * - Walk the store's editions one search at a time (the store caps how far a single
 *   search can be paged), fetching through FetchGuardService or Firecrawl.
 * - Parse product cards (name + URL only) via cheerio. Price/stock are NOT read from
 *   the listing — the store obfuscates them via CSS sprites. priceCents is always null
 *   and quantity is always 0; the detail-page queue fills in real values.
 * - Enforce the per-store rate limit between page fetches using store.lastFetchedAt.
 * - Yield IScrapedProduct records as an async generator (no memory buffering).
 * - Surface structured ScraperError instances for all error conditions.
 *
 * No database writes — the ingestion layer handles persistence.
 * Rate limit enforcement requires the caller to persist store.lastFetchedAt
 * after each fetch via the repository injected into this service.
 */
@Injectable()
export class SbraubleScraperService {
  private readonly logger = new Logger(SbraubleScraperService.name);

  constructor(
    private readonly fetchGuard: FetchGuardService,
    private readonly firecrawl: FirecrawlClientService,
    @InjectRepository(StoreEntity)
    private readonly storeRepository: Repository<StoreEntity>,
  ) {}

  /**
   * Scrapes every in-stock product of the store, edition by edition, yielding
   * each product URL once. priceCents is always null and quantity always 0
   * (price/stock come from the detail-page queue instead).
   *
   * Throws ScraperError instead of yielding a partial catalog: callers zero out
   * products missing from a completed scrape, so a silent shortfall loses data.
   */
  async *scrapeStore(store: StoreEntity): AsyncGenerator<IScrapedProduct> {
    this.validateListingPath(store.listingPath);
    const tcg = this.readTcg(store.listingPath);
    const context: IScrapeContext = { store, baseHostname: new URL(store.baseUrl).hostname, requestCount: 0 };

    const editions = await this.fetchEditions(context, tcg);
    const seenUrls = new Set<string>();
    let duplicates = 0;
    for (const edition of editions) {
      for await (const product of this.scrapeEdition(context, edition)) {
        if (seenUrls.has(product.productUrl)) {
          duplicates++;
          continue;
        }
        seenUrls.add(product.productUrl);
        yield product;
      }
    }

    this.logger.log({
      msg: 'Store listing scraped',
      storeSlug: store.slug,
      editions: editions.length,
      requests: context.requestCount,
      products: seenUrls.size,
      duplicates,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private validateListingPath(listingPath: string): void {
    if (!LISTING_PATH_REGEX.test(listingPath)) {
      throw new ScraperError(
        EScraperErrorCode.INVALID_STORE_LISTING_PATH,
        `store.listingPath '${listingPath}' does not match the ecom whitelist regex`,
      );
    }
  }

  private readTcg(listingPath: string): string {
    const tcg = new URLSearchParams(listingPath.split('?')[1] ?? '').get('tcg') ?? '';
    if (!NUMERIC_ID.test(tcg)) {
      throw new ScraperError(
        EScraperErrorCode.INVALID_STORE_LISTING_PATH,
        `store.listingPath '${listingPath}' has no numeric tcg to list editions for`,
      );
    }
    return tcg;
  }

  private async fetchEditions(context: IScrapeContext, tcg: string): Promise<string[]> {
    const url = new URL(`/?view=ecom/edicoesTCG&tcg=${tcg}`, context.store.baseUrl).href;
    const $ = cheerio.load(await this.fetchHtml(context, url));
    const editionIds = $('ul.sets_list a')
      .toArray()
      .map((el) => this.readEditionId($(el).attr('href'), context, tcg))
      .filter((id): id is string => id !== null);
    const editions = [...new Set(editionIds)];

    if (editions.length === 0) {
      throw new ScraperError(EScraperErrorCode.EDITIONS_NOT_FOUND, `No editions listed at ${url}`);
    }
    return editions;
  }

  private readEditionId(href: string | undefined, context: IScrapeContext, tcg: string): string | null {
    if (!href) return null;
    let url: URL;
    try {
      url = new URL(href, context.store.baseUrl);
    } catch {
      return null;
    }
    const params = url.searchParams;
    const edition = params.get('txt_edicao') ?? '';
    const isStoreEditionLink =
      url.hostname === context.baseHostname && params.get('view') === 'ecom/itens' && params.get('tcg') === tcg;
    return isStoreEditionLink && NUMERIC_ID.test(edition) ? edition : null;
  }

  private async *scrapeEdition(context: IScrapeContext, edition: string): AsyncGenerator<IScrapedProduct> {
    const requestsBefore = context.requestCount;
    const firstPage = await this.fetchListingPage(context, { edition }, 1);
    const splitByRarity = firstPage.total > MAX_RESULTS_PER_SEARCH;
    if (splitByRarity) {
      yield* this.scrapeEditionByRarity(context, edition, firstPage);
    } else {
      yield* this.scrapeSearch(context, { edition }, firstPage);
    }
    this.logger.log({
      msg: 'Edition scraped',
      storeSlug: context.store.slug,
      edition,
      total: firstPage.total,
      requests: context.requestCount - requestsBefore,
      splitByRarity,
    });
  }

  private async *scrapeEditionByRarity(
    context: IScrapeContext,
    edition: string,
    firstPage: IListingPage,
  ): AsyncGenerator<IScrapedProduct> {
    let raritiesTotal = 0;
    for (const rarity of firstPage.rarities) {
      const search: ISearch = { edition, rarity };
      const rarityFirstPage = await this.fetchListingPage(context, search, 1);
      if (rarityFirstPage.total > MAX_RESULTS_PER_SEARCH) {
        throw new ScraperError(
          EScraperErrorCode.PAGINATION_CAPPED,
          `${rarityFirstPage.url} has ${rarityFirstPage.total} items, more than one store search can page through`,
        );
      }
      raritiesTotal += rarityFirstPage.total;
      yield* this.scrapeSearch(context, search, rarityFirstPage);
    }

    if (raritiesTotal + LISTING_COUNT_DRIFT_TOLERANCE < firstPage.total) {
      throw new ScraperError(
        EScraperErrorCode.LISTING_INCOMPLETE,
        `${firstPage.url} reported ${firstPage.total} items but its rarity searches add up to ${raritiesTotal}`,
      );
    }
  }

  private async *scrapeSearch(
    context: IScrapeContext,
    search: ISearch,
    firstPage: IListingPage,
  ): AsyncGenerator<IScrapedProduct> {
    yield* firstPage.products;
    let itemCount = firstPage.itemCount;
    const pageCount = Math.ceil(firstPage.total / LISTING_PAGE_SIZE);
    for (let page = 2; page <= pageCount; page++) {
      const listing = await this.fetchListingPage(context, search, page);
      itemCount += listing.itemCount;
      yield* listing.products;
    }

    if (itemCount + LISTING_COUNT_DRIFT_TOLERANCE < firstPage.total) {
      throw new ScraperError(
        EScraperErrorCode.LISTING_INCOMPLETE,
        `${firstPage.url} reported ${firstPage.total} items but its pages held ${itemCount}`,
      );
    }
  }

  private async fetchListingPage(context: IScrapeContext, search: ISearch, page: number): Promise<IListingPage> {
    const url = this.buildSearchUrl(context.store, search, page);
    const html = await this.fetchHtml(context, url);
    const $ = cheerio.load(html);

    if ($('select[name="txt_limit"]').length === 0) {
      throw new ScraperError(
        EScraperErrorCode.LISTING_UNRECOGNIZED,
        `${url} did not return a listing page (${describePage($, html)})`,
      );
    }
    const notice = $('.alertaErro').text().trim();
    if (PAGINATION_CAP_NOTICE.test(notice)) {
      throw new ScraperError(EScraperErrorCode.PAGINATION_CAPPED, `The store refused to page ${url}: ${notice}`);
    }
    const rarities = $('select[name="txt_raridade"] option')
      .toArray()
      .map((el) => $(el).attr('value') ?? '')
      .filter((value) => NUMERIC_ID.test(value));
    if (NO_RESULTS_NOTICE.test(notice)) {
      return { url, total: 0, itemCount: 0, products: [], rarities };
    }

    const reportedTotal = $('.cards td.textoMaior b').first().text().replace(/[.,]/g, '').trim();
    if (!NUMERIC_ID.test(reportedTotal)) {
      throw new ScraperError(
        EScraperErrorCode.LISTING_UNRECOGNIZED,
        `${url} did not report a result count (${describePage($, html)})`,
      );
    }
    return {
      url,
      total: Number(reportedTotal),
      itemCount: $('.card-item').length,
      products: this.parseProducts($, context),
      rarities,
    };
  }

  /**
   * Appends the search filters to the validated listing href as a string:
   * URLSearchParams would percent-encode the slash in 'ecom/itens', which the
   * Sbrauble server may reject. Edition and rarity are digit-only by construction.
   */
  private buildSearchUrl(store: StoreEntity, search: ISearch, page: number): string {
    const listingHref = new URL(store.listingPath, store.baseUrl).href;
    const rarityFilter = search.rarity ? `&txt_raridade=${search.rarity}` : '';
    return (
      `${listingHref}&txt_edicao=${search.edition}&txt_limit=${LISTING_PAGE_SIZE}` +
      `&txt_estoque=1${rarityFilter}&page=${page}`
    );
  }

  private async fetchHtml(context: IScrapeContext, url: string): Promise<string> {
    context.requestCount++;
    if (context.requestCount > MAX_REQUESTS_PER_SCRAPE) {
      throw new ScraperError(
        EScraperErrorCode.PAGINATION_RUNAWAY,
        `Exceeded ${MAX_REQUESTS_PER_SCRAPE} requests for store '${context.store.slug}'`,
      );
    }

    await this.enforceRateLimit(context.store);
    let html: string;
    try {
      if (this.firecrawl.isEnabled()) {
        // Firecrawl clears the store's Cloudflare challenge (datacenter IPs
        // are otherwise served a stripped page) via residential proxies.
        html = await this.firecrawl.scrapeHtml(url);
      } else {
        const result = await this.fetchGuard.guardedFetch(url, {
          allowHosts: [context.baseHostname],
          maxBytes: MAX_BYTES,
          timeoutMs: REQUEST_TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RatheArsenal/1.0)',
            'Accept': 'text/html',
          },
        });
        html = Buffer.from(result.body).toString('utf-8');
      }
    } catch (err) {
      throw new ScraperError(EScraperErrorCode.PARSE_FAILED, `Fetch failed for ${url}: ${(err as Error).message}`);
    }
    await this.persistLastFetchedAt(context.store);
    return html;
  }

  /**
   * Computes elapsed time since the last fetch and sleeps the remaining portion
   * of store.rateLimitMs. Persists store.lastFetchedAt on the entity so the
   * sleep is correctly bounded across pod restarts and concurrent trigger scenarios.
   */
  private async enforceRateLimit(store: StoreEntity): Promise<void> {
    if (store.lastFetchedAt !== null) {
      const elapsed = Date.now() - store.lastFetchedAt.getTime();
      const remaining = Math.max(0, store.rateLimitMs - elapsed);
      if (remaining > 0) {
        this.logger.debug({ msg: 'Rate limiting', remainingMs: remaining, storeSlug: store.slug });
        await sleep(remaining);
      }
    }
  }

  /**
   * Updates store.lastFetchedAt to now and persists the change.
   * This ensures subsequent calls (and other processes) see the accurate
   * timestamp even after a pod restart.
   */
  private async persistLastFetchedAt(store: StoreEntity): Promise<void> {
    const now = new Date();
    // Mutate only the timestamp field via repository update — no full-entity mutation.
    await this.storeRepository.update({ id: store.id }, { lastFetchedAt: now });
    // Reflect the change on the in-memory entity so the next enforceRateLimit
    // call in this same run uses the updated value without re-querying.
    (store as { lastFetchedAt: Date }).lastFetchedAt = now;
  }

  /**
   * Returns all valid product rows of a loaded listing page.
   *
   * Extracts only rawName (from `.card-desc .title a` text) and productUrl
   * (from `.card-desc .title a` href). Price and stock are NOT read from the
   * listing — the CSS-sprite obfuscation makes them unreliable. Both fields
   * are set to their sentinel values (priceCents=null, quantity=0) so the
   * detail-page queue can supply the real values later.
   *
   * Rows with out-of-allow-list product URLs are dropped with a warn log.
   */
  private parseProducts($: cheerio.CheerioAPI, context: IScrapeContext): IScrapedProduct[] {
    const baseUrl = context.store.baseUrl;
    const products: IScrapedProduct[] = [];

    $('.card-item').each((_i, el) => {
      const rawName = $(el).find('.card-desc .title a').text().trim();
      const rawHref = $(el).find('.card-desc .title a').attr('href') ?? '';

      if (!rawName) {
        this.logger.warn({ msg: 'Product row missing name — skipped', baseUrl });
        return;
      }

      // Validate and resolve product URL
      const productUrl = this.resolveProductUrl(rawHref, baseUrl, context.baseHostname);
      if (productUrl === null) {
        return; // warn already logged inside resolveProductUrl
      }

      // Price and stock come from the detail-page queue; listing always yields sentinel values.
      products.push({ rawName, priceCents: null, quantity: 0, productUrl });
    });

    return products;
  }

  /**
   * Resolves a raw href to an absolute URL and validates it against the store's
   * hostname (strict equality) and protocol (https: only).
   *
   * Returns null and logs a warning if the URL fails validation.
   */
  private resolveProductUrl(rawHref: string, baseUrl: string, expectedHostname: string): string | null {
    if (!rawHref) {
      this.logger.warn({ msg: 'Product row missing href — dropped', code: EScraperErrorCode.URL_OUT_OF_ALLOW_LIST });
      return null;
    }

    let resolved: URL;
    try {
      resolved = new URL(rawHref, baseUrl);
    } catch {
      this.logger.warn({
        msg: 'Product URL is not parseable — dropped',
        rawHref,
        code: EScraperErrorCode.URL_OUT_OF_ALLOW_LIST,
      });
      return null;
    }

    if (resolved.hostname !== expectedHostname) {
      this.logger.warn({
        msg: 'Product URL hostname not in allow-list — dropped',
        actualHostname: resolved.hostname,
        expectedHostname,
        rawHref,
        code: EScraperErrorCode.URL_OUT_OF_ALLOW_LIST,
      });
      return null;
    }

    if (resolved.protocol !== 'https:') {
      this.logger.warn({
        msg: 'Product URL protocol is not https — dropped',
        protocol: resolved.protocol,
        rawHref,
        code: EScraperErrorCode.URL_OUT_OF_ALLOW_LIST,
      });
      return null;
    }

    return resolved.toString();
  }

}

// ---------------------------------------------------------------------------
// Module-private utility
// ---------------------------------------------------------------------------

function describePage($: cheerio.CheerioAPI, html: string): string {
  const title = $('title').first().text().trim();
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, PAGE_EVIDENCE_TEXT_CHARS);
  return `${html.length} bytes, title "${title}", text "${text}"`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

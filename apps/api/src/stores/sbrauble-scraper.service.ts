import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as cheerio from 'cheerio';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../database/entities/store.entity';
import { IScrapedProduct } from './types/scraped-product';
import { EScraperErrorCode, ScraperError } from './errors/scraper.errors';
import { parsePriceCents, parseQuantity } from './utils/price-stock-parsers';

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

/**
 * Maximum pages to fetch before aborting with PAGINATION_RUNAWAY.
 * Belt-and-suspenders guard against infinite-loop pagination bugs.
 */
const MAX_PAGES = 200;

/**
 * Maximum response body size per page fetch (5 MB).
 * A typical Sbrauble listing page is well under 500 KB.
 */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Timeout per HTTP request in milliseconds.
 */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Price strings that indicate the product has no public price.
 * Rows with these values are yielded with priceCents=null and quantity=0.
 *
 * Listing-level check only. The detail parser uses isUnavailablePrice() from
 * utils/price-stock-parsers.ts, which uses the same string set but applies
 * different logic: it excludes the row entirely rather than yielding it with null.
 */
const UNAVAILABLE_PRICE_STRINGS = new Set(['sob consulta', 'indisponível', 'indisponivel']);

/**
 * Scrapes a Sbrauble-platform e-commerce store (Phase 1b: Cúpula DT only).
 *
 * Responsibilities:
 * - Validate the store's listingPath against the ecom whitelist regex.
 * - Fetch paginated listing pages through FetchGuardService (zero direct fetch() calls).
 * - Parse product cards (name, price, stock, URL) via cheerio.
 * - Enforce the per-store rate limit between page fetches using store.lastFetchedAt.
 * - Yield IScrapedProduct records as an async generator (no memory buffering).
 * - Surface structured ScraperError instances for all error conditions.
 *
 * No database writes — the ingestion layer (Unit 4) handles persistence.
 * Rate limit enforcement requires the caller to persist store.lastFetchedAt
 * after each fetch via the repository injected into this service.
 */
@Injectable()
export class SbraubleScraperService {
  private readonly logger = new Logger(SbraubleScraperService.name);

  constructor(
    private readonly fetchGuard: FetchGuardService,
    @InjectRepository(StoreEntity)
    private readonly storeRepository: Repository<StoreEntity>,
  ) {}

  /**
   * Scrapes all listing pages for the given store.
   *
   * Yields IScrapedProduct for each valid product row. Rows with out-of-allow-list
   * product URLs are dropped with a warn log rather than aborting the generator.
   *
   * Throws ScraperError for unrecoverable conditions:
   * - INVALID_STORE_LISTING_PATH — listingPath fails whitelist regex (before first fetch)
   * - PAGINATION_RUNAWAY — more than MAX_PAGES pages fetched without termination
   * - PARSE_FAILED — stock text cannot be parsed
   * - PRICE_UNPARSEABLE — price text is non-empty but not a known BRL format
   */
  async *scrapeStore(store: StoreEntity): AsyncGenerator<IScrapedProduct> {
    this.validateListingPath(store.listingPath);

    const baseHostname = new URL(store.baseUrl).hostname;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const pageUrl = this.buildPageUrl(store.baseUrl, store.listingPath, page);

      await this.enforceRateLimit(store);

      let htmlBody: string;
      try {
        const result = await this.fetchGuard.guardedFetch(pageUrl, {
          allowHosts: [baseHostname],
          maxBytes: MAX_BYTES,
          timeoutMs: REQUEST_TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RatheArsenal/1.0)',
            'Accept': 'text/html',
          },
        });
        htmlBody = Buffer.from(result.body).toString('utf-8');
      } catch (err) {
        throw new ScraperError(
          EScraperErrorCode.PARSE_FAILED,
          `Fetch failed for ${pageUrl}: ${(err as Error).message}`,
        );
      }

      await this.persistLastFetchedAt(store);

      if (page === 1) {
        this.logger.log({
          msg: 'First page HTML stats',
          storeSlug: store.slug,
          htmlLength: htmlBody.length,
          hasCardItem: htmlBody.includes('card-item'),
          hasCards: htmlBody.includes('class="cards"'),
          snippet: htmlBody.substring(0, 500),
        });
      }

      const products = this.parsePage(htmlBody, store.baseUrl, baseHostname);

      if (products.length === 0) {
        this.logger.log({ msg: 'Empty page reached — pagination complete', page, storeSlug: store.slug });
        return;
      }

      this.logger.log({ msg: 'Page scraped', page, productCount: products.length, storeSlug: store.slug });

      for (const product of products) {
        yield product;
      }
    }

    throw new ScraperError(
      EScraperErrorCode.PAGINATION_RUNAWAY,
      `Exceeded ${MAX_PAGES} pages for store '${store.slug}' without reaching an empty page`,
    );
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

  /**
   * Constructs the page URL by parsing the base URL and listing path via
   * new URL() and then appending the page parameter to the href string.
   *
   * Rationale for href-append rather than searchParams.set():
   * URLSearchParams.set() percent-encodes slash characters in existing param
   * values (e.g. 'ecom/itens' → 'ecom%2Fitens'), which the Sbrauble server
   * may reject. The listingPath has already been validated against the
   * whitelist regex, so direct string append to the validated href is safe.
   */
  private buildPageUrl(baseUrl: string, listingPath: string, page: number): string {
    const url = new URL(listingPath, baseUrl);
    return `${url.href}&page=${page}`;
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
    // eslint-disable-next-line no-param-reassign
    (store as { lastFetchedAt: Date }).lastFetchedAt = now;
  }

  /**
   * Parses the HTML body of a listing page and returns all valid product rows.
   *
   * Invalid rows (bad product URL host/protocol) are dropped with a warn log.
   * Price and stock parsing errors throw ScraperError to abort the current page.
   */
  private parsePage(html: string, baseUrl: string, baseHostname: string): IScrapedProduct[] {
    const $ = cheerio.load(html);
    const cards = $('.card-item');

    if (cards.length === 0) {
      return [];
    }

    const products: IScrapedProduct[] = [];

    cards.each((_i, el) => {
      const rawName = $(el).find('.card-desc .title a').text().trim();
      const rawPrice = $(el).find('.card-desc .price').text().trim();
      const rawStock = $(el).find('.card-desc .qty').text().trim();
      const rawHref = $(el).find('.card-desc .title a').attr('href') ?? '';

      if (!rawName) {
        this.logger.warn({ msg: 'Product row missing name — skipped', baseUrl });
        return;
      }

      // Validate and resolve product URL
      const productUrl = this.resolveProductUrl(rawHref, baseUrl, baseHostname);
      if (productUrl === null) {
        return; // warn already logged inside resolveProductUrl
      }

      // Parse price and stock
      const { priceCents, quantity } = this.parsePriceAndStock(rawPrice, rawStock);

      products.push({ rawName, priceCents, quantity, productUrl });
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

  /**
   * Parses the raw price and stock strings from a product row.
   *
   * Price formats:
   *   "R$ 49,90"     → 4990
   *   "R$ 0,25"      → 25
   *   "R$ 1.234,50"  → 123450  (thousands separator "." is stripped)
   *   "Sob consulta" → null    (quantity forced to 0)
   *   "Indisponível" → null    (quantity forced to 0)
   *
   * Stock formats:
   *   "37 unid."  → 37
   *   "1 unid."   → 1
   *   "Esgotado"  → 0
   *
   * Throws ScraperError(PRICE_UNPARSEABLE) if the price string is non-empty
   * but does not match any recognized format.
   * Throws ScraperError(PARSE_FAILED) if the stock string cannot be parsed.
   */
  private parsePriceAndStock(rawPrice: string, rawStock: string): { priceCents: number | null; quantity: number } {
    const priceNormalized = rawPrice.trim().toLowerCase();

    // Unavailable price — yield with null price and zero quantity
    if (UNAVAILABLE_PRICE_STRINGS.has(priceNormalized)) {
      return { priceCents: null, quantity: 0 };
    }

    const priceCents = parsePriceCents(rawPrice);
    const quantity = parseQuantity(rawStock);

    return { priceCents, quantity };
  }

}

// ---------------------------------------------------------------------------
// Module-private utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

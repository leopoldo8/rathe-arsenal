import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { EScraperFetchProvider } from '../config/env.dto';
import { EScraperErrorCode, ScraperError } from './errors/scraper.errors';

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
const FIRECRAWL_HOST = 'api.firecrawl.dev';

/**
 * Proxy tier. `auto` tries basic datacenter proxies first and transparently
 * retries with premium residential proxies when the target challenges the
 * request — the right default for a Cloudflare-gated store (cost-optimal yet
 * still escalates to bypass the challenge).
 */
const FIRECRAWL_PROXY_MODE = 'auto';

/** Firecrawl's own render timeout (ms), passed in the request body. */
const FIRECRAWL_RENDER_TIMEOUT_MS = 60_000;

/** Our outer HTTP timeout — must exceed Firecrawl's render timeout. */
const FIRECRAWL_REQUEST_TIMEOUT_MS = 90_000;

/** Max response size (the JSON envelope wraps the full rendered HTML). */
const FIRECRAWL_MAX_BYTES = 8 * 1024 * 1024;

interface IFirecrawlScrapeResponse {
  readonly success?: boolean;
  readonly data?: { readonly rawHtml?: unknown };
  readonly error?: unknown;
}

/**
 * Thin client over Firecrawl's `/scrape` API. Used as an alternate detail-page
 * fetcher when SCRAPER_FETCH_PROVIDER=firecrawl, so store pages behind a
 * Cloudflare challenge (which blocks the Railway datacenter IP) can still be
 * fetched via Firecrawl's residential proxies.
 *
 * Returns the post-JS rendered `rawHtml` so the existing detail parser runs
 * against it unchanged. All outbound traffic routes through FetchGuardService
 * per the codebase's SSRF-allow-list convention.
 */
@Injectable()
export class FirecrawlClientService {
  private readonly logger = new Logger(FirecrawlClientService.name);
  private readonly apiKey: string | undefined;
  private readonly provider: EScraperFetchProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly fetchGuard: FetchGuardService,
  ) {
    this.apiKey = this.config.get<string>('FIRECRAWL_API_KEY') || undefined;
    this.provider =
      this.config.get<EScraperFetchProvider>('SCRAPER_FETCH_PROVIDER') ??
      EScraperFetchProvider.Direct;

    if (this.provider === EScraperFetchProvider.Firecrawl && !this.apiKey) {
      this.logger.warn({
        event: 'firecrawl.misconfigured',
        msg: 'SCRAPER_FETCH_PROVIDER=firecrawl but FIRECRAWL_API_KEY is missing — falling back to direct fetch',
      });
    } else if (this.isEnabled()) {
      this.logger.log({ event: 'firecrawl.enabled', proxyMode: FIRECRAWL_PROXY_MODE });
    }
  }

  /** True when Firecrawl should be used for fetches (flag set AND key present). */
  isEnabled(): boolean {
    return this.provider === EScraperFetchProvider.Firecrawl && Boolean(this.apiKey);
  }

  /**
   * Fetches `url` through Firecrawl and returns the post-JS rendered HTML.
   * Throws ScraperError(FIRECRAWL_REQUEST_FAILED) on any transport/shape error.
   */
  async scrapeHtml(url: string): Promise<string> {
    const result = await this.fetchGuard.guardedFetch(FIRECRAWL_ENDPOINT, {
      allowHosts: [FIRECRAWL_HOST],
      maxBytes: FIRECRAWL_MAX_BYTES,
      timeoutMs: FIRECRAWL_REQUEST_TIMEOUT_MS,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        proxy: FIRECRAWL_PROXY_MODE,
        formats: ['rawHtml'],
        onlyMainContent: false,
        timeout: FIRECRAWL_RENDER_TIMEOUT_MS,
      }),
    });

    if (result.status < 200 || result.status >= 300) {
      throw new ScraperError(
        EScraperErrorCode.FIRECRAWL_REQUEST_FAILED,
        `Firecrawl returned HTTP ${result.status}`,
      );
    }

    let parsed: IFirecrawlScrapeResponse;
    try {
      parsed = JSON.parse(Buffer.from(result.body).toString('utf-8')) as IFirecrawlScrapeResponse;
    } catch {
      throw new ScraperError(
        EScraperErrorCode.FIRECRAWL_REQUEST_FAILED,
        'Firecrawl returned a non-JSON body',
      );
    }

    const html = parsed.data?.rawHtml;
    if (typeof html !== 'string' || html.length === 0) {
      throw new ScraperError(
        EScraperErrorCode.FIRECRAWL_REQUEST_FAILED,
        'Firecrawl response missing data.rawHtml',
      );
    }

    return html;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FetchGuardService, IGuardedFetchResult } from '../common/fetch-guard/fetch-guard.service';
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

/** Free plan /scrape limit, per https://docs.firecrawl.dev/rate-limits. */
const FIRECRAWL_DEFAULT_REQUESTS_PER_MINUTE = 10;
const FIRECRAWL_PACING_SAFETY_FACTOR = 1.1;
const FIRECRAWL_MAX_ATTEMPTS = 3;
const FIRECRAWL_RATE_LIMIT_FALLBACK_WAIT_MS = 60_000;
const HTTP_TOO_MANY_REQUESTS = 429;
const FIRECRAWL_ERROR_DETAIL_MAX_CHARS = 300;

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
  private readonly minRequestIntervalMs: number;
  private nextRequestAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly fetchGuard: FetchGuardService,
  ) {
    this.apiKey = this.config.get<string>('FIRECRAWL_API_KEY') || undefined;
    this.provider =
      this.config.get<EScraperFetchProvider>('SCRAPER_FETCH_PROVIDER') ??
      EScraperFetchProvider.Direct;
    const requestsPerMinute =
      this.config.get<number>('FIRECRAWL_REQUESTS_PER_MINUTE') ?? FIRECRAWL_DEFAULT_REQUESTS_PER_MINUTE;
    this.minRequestIntervalMs = Math.ceil((60_000 / requestsPerMinute) * FIRECRAWL_PACING_SAFETY_FACTOR);

    if (this.provider === EScraperFetchProvider.Firecrawl && !this.apiKey) {
      this.logger.warn({
        event: 'firecrawl.misconfigured',
        msg: 'SCRAPER_FETCH_PROVIDER=firecrawl but FIRECRAWL_API_KEY is missing — falling back to direct fetch',
      });
    } else if (this.isEnabled()) {
      this.logger.log({
        event: 'firecrawl.enabled',
        proxyMode: FIRECRAWL_PROXY_MODE,
        requestsPerMinute,
      });
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
    for (let attempt = 1; ; attempt++) {
      await this.waitForRequestSlot();
      const result = await this.requestScrape(url);

      if (result.status !== HTTP_TOO_MANY_REQUESTS || attempt >= FIRECRAWL_MAX_ATTEMPTS) {
        return this.extractHtml(result);
      }

      const waitMs = parseRetryAfterMs(result.headers['retry-after']) ?? FIRECRAWL_RATE_LIMIT_FALLBACK_WAIT_MS;
      this.logger.warn({ event: 'firecrawl.rate_limited', url, attempt, waitMs });
      this.deferAllRequestsFor(waitMs);
    }
  }

  private deferAllRequestsFor(waitMs: number): void {
    this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + waitMs);
  }

  private async waitForRequestSlot(): Promise<void> {
    const now = Date.now();
    const startAt = Math.max(now, this.nextRequestAt);
    // Reserve before awaiting, or concurrent callers would share one slot.
    this.nextRequestAt = startAt + this.minRequestIntervalMs;
    if (startAt > now) {
      await sleep(startAt - now);
    }
  }

  private requestScrape(url: string): Promise<IGuardedFetchResult> {
    return this.fetchGuard.guardedFetch(FIRECRAWL_ENDPOINT, {
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
  }

  private extractHtml(result: IGuardedFetchResult): string {
    if (result.status < 200 || result.status >= 300) {
      throw new ScraperError(
        EScraperErrorCode.FIRECRAWL_REQUEST_FAILED,
        `Firecrawl returned HTTP ${result.status}${formatErrorDetail(result.body)}`,
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

function parseRetryAfterMs(header: string | undefined): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function formatErrorDetail(body: Uint8Array): string {
  const text = Buffer.from(body).toString('utf-8').trim();
  if (text.length === 0) return '';
  return `: ${readErrorField(text).slice(0, FIRECRAWL_ERROR_DETAIL_MAX_CHARS)}`;
}

function readErrorField(text: string): string {
  try {
    const parsed = JSON.parse(text) as IFirecrawlScrapeResponse;
    return typeof parsed.error === 'string' ? parsed.error : text;
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

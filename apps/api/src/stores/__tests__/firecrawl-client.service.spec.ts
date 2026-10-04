import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { FirecrawlClientService } from '../firecrawl-client.service';
import { EScraperErrorCode, ScraperError } from '../errors/scraper.errors';

interface IEnv {
  SCRAPER_FETCH_PROVIDER?: string;
  FIRECRAWL_API_KEY?: string;
  FIRECRAWL_REQUESTS_PER_MINUTE?: number;
}

async function buildService(env: IEnv, fetchGuard = createMock<FetchGuardService>()): Promise<{
  service: FirecrawlClientService;
  fetchGuard: ReturnType<typeof createMock<FetchGuardService>>;
}> {
  const config = createMock<ConfigService>();
  (config.get as jest.Mock).mockImplementation((key: string) => (env as Record<string, unknown>)[key]);
  const moduleRef = await Test.createTestingModule({
    providers: [
      FirecrawlClientService,
      { provide: ConfigService, useValue: config },
      { provide: FetchGuardService, useValue: fetchGuard },
    ],
  }).compile();
  return { service: moduleRef.get(FirecrawlClientService), fetchGuard };
}

function okResponse(bodyObj: unknown) {
  return { status: 200, headers: {}, body: new Uint8Array(Buffer.from(JSON.stringify(bodyObj))) };
}

function rateLimitedResponse(headers: Record<string, string> = {}) {
  const body = { success: false, error: 'Rate limit exceeded. Consumed (req/min): 11, Remaining (req/min): 0.' };
  return { status: 429, headers, body: new Uint8Array(Buffer.from(JSON.stringify(body))) };
}

function gapMs(callTimes: number[], from: number, to: number): number {
  return (callTimes[to] ?? Number.NaN) - (callTimes[from] ?? Number.NaN);
}

const HTML_OK = okResponse({ success: true, data: { rawHtml: '<html>ok</html>' } });

describe('FirecrawlClientService', () => {
  describe('isEnabled', () => {
    it('is disabled by default (provider unset)', async () => {
      const { service } = await buildService({});
      expect(service.isEnabled()).toBe(false);
    });

    it('is disabled when provider=firecrawl but the key is missing', async () => {
      const { service } = await buildService({ SCRAPER_FETCH_PROVIDER: 'firecrawl' });
      expect(service.isEnabled()).toBe(false);
    });

    it('is disabled when the key is set but provider=direct', async () => {
      const { service } = await buildService({ SCRAPER_FETCH_PROVIDER: 'direct', FIRECRAWL_API_KEY: 'fc-x' });
      expect(service.isEnabled()).toBe(false);
    });

    it('is enabled when provider=firecrawl and the key is present', async () => {
      const { service } = await buildService({ SCRAPER_FETCH_PROVIDER: 'firecrawl', FIRECRAWL_API_KEY: 'fc-x' });
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('scrapeHtml', () => {
    const enabledEnv: IEnv = { SCRAPER_FETCH_PROVIDER: 'firecrawl', FIRECRAWL_API_KEY: 'fc-secret' };

    it('returns data.rawHtml and sends a bearer-authed POST to the firecrawl host', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      fetchGuard.guardedFetch.mockResolvedValue(okResponse({ success: true, data: { rawHtml: '<html>ok</html>' } }) as never);
      const { service } = await buildService(enabledEnv, fetchGuard);

      const html = await service.scrapeHtml('https://www.cupuladt.com.br/item?id=1');

      expect(html).toBe('<html>ok</html>');
      const [url, opts] = (fetchGuard.guardedFetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://api.firecrawl.dev/v2/scrape');
      expect(opts.method).toBe('POST');
      expect(opts.allowHosts).toEqual(['api.firecrawl.dev']);
      expect(opts.headers.Authorization).toBe('Bearer fc-secret');
      expect(JSON.parse(opts.body).url).toBe('https://www.cupuladt.com.br/item?id=1');
      expect(JSON.parse(opts.body).formats).toEqual(['rawHtml']);
    });

    it('throws FIRECRAWL_REQUEST_FAILED on a non-2xx response', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      fetchGuard.guardedFetch.mockResolvedValue({ status: 402, headers: {}, body: new Uint8Array() } as never);
      const { service } = await buildService(enabledEnv, fetchGuard);

      await expect(service.scrapeHtml('https://x.test/p')).rejects.toMatchObject({
        code: EScraperErrorCode.FIRECRAWL_REQUEST_FAILED,
      });
    });

    it('throws FIRECRAWL_REQUEST_FAILED when rawHtml is missing', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      fetchGuard.guardedFetch.mockResolvedValue(okResponse({ success: true, data: {} }) as never);
      const { service } = await buildService(enabledEnv, fetchGuard);

      await expect(service.scrapeHtml('https://x.test/p')).rejects.toBeInstanceOf(ScraperError);
    });

    it('does not retry a non-429 failure and includes the Firecrawl error in the message', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const body = new Uint8Array(Buffer.from(JSON.stringify({ success: false, error: 'Insufficient credits' })));
      fetchGuard.guardedFetch.mockResolvedValue({ status: 402, headers: {}, body } as never);
      const { service } = await buildService(enabledEnv, fetchGuard);

      await expect(service.scrapeHtml('https://x.test/p')).rejects.toThrow(
        'Firecrawl returned HTTP 402: Insufficient credits',
      );
      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limiting', () => {
    const freePlanEnv: IEnv = { SCRAPER_FETCH_PROVIDER: 'firecrawl', FIRECRAWL_API_KEY: 'fc-secret' };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function recordCallTimes(fetchGuard: ReturnType<typeof createMock<FetchGuardService>>): number[] {
      const callTimes: number[] = [];
      (fetchGuard.guardedFetch as jest.Mock).mockImplementation(async () => {
        callTimes.push(Date.now());
        return HTML_OK;
      });
      return callTimes;
    }

    it('spaces sequential requests to stay under the default 10 requests per minute', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const callTimes = recordCallTimes(fetchGuard);
      const { service } = await buildService(freePlanEnv, fetchGuard);

      const first = service.scrapeHtml('https://x.test/1');
      await jest.advanceTimersByTimeAsync(0);
      await first;
      const second = service.scrapeHtml('https://x.test/2');
      await jest.advanceTimersByTimeAsync(60_000);
      await second;

      expect(callTimes).toHaveLength(2);
      expect(gapMs(callTimes, 0, 1)).toBeGreaterThanOrEqual(6_000);
    });

    it('spaces concurrent requests too, so parallel callers cannot burst past the limit', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const callTimes = recordCallTimes(fetchGuard);
      const { service } = await buildService(freePlanEnv, fetchGuard);

      const all = Promise.all([
        service.scrapeHtml('https://x.test/1'),
        service.scrapeHtml('https://x.test/2'),
        service.scrapeHtml('https://x.test/3'),
      ]);
      await jest.advanceTimersByTimeAsync(60_000);
      await all;

      expect(callTimes).toHaveLength(3);
      expect(gapMs(callTimes, 0, 1)).toBeGreaterThanOrEqual(6_000);
      expect(gapMs(callTimes, 1, 2)).toBeGreaterThanOrEqual(6_000);
    });

    it('fits more requests in a minute when FIRECRAWL_REQUESTS_PER_MINUTE is raised', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const callTimes = recordCallTimes(fetchGuard);
      const { service } = await buildService({ ...freePlanEnv, FIRECRAWL_REQUESTS_PER_MINUTE: 100 }, fetchGuard);

      const all = Promise.all([service.scrapeHtml('https://x.test/1'), service.scrapeHtml('https://x.test/2')]);
      await jest.advanceTimersByTimeAsync(60_000);
      await all;

      expect(gapMs(callTimes, 0, 1)).toBeGreaterThanOrEqual(600);
      expect(gapMs(callTimes, 0, 1)).toBeLessThan(6_000);
    });

    it('retries a 429 after the Retry-After delay and returns the HTML', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const callTimes: number[] = [];
      (fetchGuard.guardedFetch as jest.Mock)
        .mockImplementationOnce(async () => {
          callTimes.push(Date.now());
          return rateLimitedResponse({ 'retry-after': '20' });
        })
        .mockImplementationOnce(async () => {
          callTimes.push(Date.now());
          return HTML_OK;
        });
      const { service } = await buildService(freePlanEnv, fetchGuard);

      const result = service.scrapeHtml('https://x.test/p');
      await jest.advanceTimersByTimeAsync(120_000);

      await expect(result).resolves.toBe('<html>ok</html>');
      expect(callTimes).toHaveLength(2);
      expect(gapMs(callTimes, 0, 1)).toBeGreaterThanOrEqual(20_000);
    });

    it('waits a full minute before retrying a 429 that has no Retry-After header', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const callTimes: number[] = [];
      (fetchGuard.guardedFetch as jest.Mock)
        .mockImplementationOnce(async () => {
          callTimes.push(Date.now());
          return rateLimitedResponse();
        })
        .mockImplementationOnce(async () => {
          callTimes.push(Date.now());
          return HTML_OK;
        });
      const { service } = await buildService(freePlanEnv, fetchGuard);

      const result = service.scrapeHtml('https://x.test/p');
      await jest.advanceTimersByTimeAsync(59_000);
      expect(callTimes).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(10_000);

      await expect(result).resolves.toBe('<html>ok</html>');
      expect(gapMs(callTimes, 0, 1)).toBeGreaterThanOrEqual(60_000);
    });

    it('holds back other callers while waiting out a 429', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      const callTimes: number[] = [];
      (fetchGuard.guardedFetch as jest.Mock)
        .mockImplementationOnce(async () => {
          callTimes.push(Date.now());
          return rateLimitedResponse({ 'retry-after': '30' });
        })
        .mockImplementation(async () => {
          callTimes.push(Date.now());
          return HTML_OK;
        });
      const { service } = await buildService(freePlanEnv, fetchGuard);

      const first = service.scrapeHtml('https://x.test/1');
      await jest.advanceTimersByTimeAsync(0);
      const second = service.scrapeHtml('https://x.test/2');
      await jest.advanceTimersByTimeAsync(120_000);
      await Promise.all([first, second]);

      expect(callTimes).toHaveLength(3);
      expect(gapMs(callTimes, 0, 1)).toBeGreaterThanOrEqual(30_000);
      expect(gapMs(callTimes, 0, 2)).toBeGreaterThanOrEqual(30_000);
    });

    it('gives up after 3 rate-limited attempts with the Firecrawl error in the message', async () => {
      const fetchGuard = createMock<FetchGuardService>();
      fetchGuard.guardedFetch.mockResolvedValue(rateLimitedResponse({ 'retry-after': '1' }) as never);
      const { service } = await buildService(freePlanEnv, fetchGuard);

      const result = service.scrapeHtml('https://x.test/p');
      const assertion = expect(result).rejects.toMatchObject({
        code: EScraperErrorCode.FIRECRAWL_REQUEST_FAILED,
        message: expect.stringContaining('Firecrawl returned HTTP 429: Rate limit exceeded'),
      });
      await jest.advanceTimersByTimeAsync(120_000);
      await assertion;
      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(3);
    });
  });
});

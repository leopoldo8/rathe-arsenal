import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { FirecrawlClientService } from '../firecrawl-client.service';
import { EScraperErrorCode, ScraperError } from '../errors/scraper.errors';

interface IEnv {
  SCRAPER_FETCH_PROVIDER?: string;
  FIRECRAWL_API_KEY?: string;
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
  });
});

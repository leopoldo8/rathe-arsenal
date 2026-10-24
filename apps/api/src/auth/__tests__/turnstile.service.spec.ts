import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from '../turnstile.service';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const HOUR_MS = 60 * 60 * 1000;

function buildService(secret: string | undefined): TurnstileService {
  const config = { get: (key: string) => (key === 'TURNSTILE_SECRET_KEY' ? secret : undefined) } as unknown as ConfigService;
  return new TurnstileService(config);
}

function answer(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

describe('TurnstileService', () => {
  let fetchSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(answer({ success: true }));
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('siteverify is called with the secret and the token', async () => {
    await buildService('secret-1').assertHuman('token-1', '203.0.113.9');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe('POST');
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get('secret')).toBe('secret-1');
    expect(sent.get('response')).toBe('token-1');
  });

  it('refuses a token Cloudflare does not accept, and a request with no token without asking', async () => {
    fetchSpy.mockResolvedValueOnce(answer({ success: false, 'error-codes': ['invalid-input-response'] }));
    const service = buildService('secret-1');

    await expect(service.assertHuman('bad', undefined)).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
    fetchSpy.mockClear();
    await expect(service.assertHuman(undefined, undefined)).rejects.toMatchObject({ code: 'CAPTCHA_FAILED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an absent secret skips the check and warns once an hour', async () => {
    const service = buildService(undefined);
    const now = jest.spyOn(Date, 'now');
    const start = 1_800_000_000_000;

    now.mockReturnValue(start);
    await service.assertHuman('anything', '203.0.113.9');
    await service.assertHuman(undefined, '203.0.113.9');
    now.mockReturnValue(start + HOUR_MS - 1);
    await service.assertHuman('anything', '203.0.113.9');
    expect(warnSpy).toHaveBeenCalledTimes(1);

    now.mockReturnValue(start + HOUR_MS);
    await service.assertHuman('anything', '203.0.113.9');
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an unreachable siteverify lets the request through and warns', async () => {
    const service = buildService('secret-1');
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(service.assertHuman('token-1', undefined)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'auth.turnstile.unreachable', reason: 'fetch failed' }));

    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    fetchSpy.mockRejectedValueOnce(timeout);
    await expect(service.assertHuman('token-1', undefined)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'auth.turnstile.unreachable', reason: 'The operation was aborted due to timeout' }));

    fetchSpy.mockResolvedValueOnce(answer({}, false));
    await expect(service.assertHuman('token-1', undefined)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});

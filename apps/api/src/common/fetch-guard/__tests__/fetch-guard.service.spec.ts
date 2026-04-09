import { FetchGuardService } from '../fetch-guard.service';
import { EFetchGuardErrorCode, FetchGuardError } from '../errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FetchMock = jest.Mock<Promise<Response>, [any, any?]>;

describe('FetchGuardService', () => {
  let service: FetchGuardService;
  let originalFetch: typeof fetch;
  let fetchMock: FetchMock;

  const ALLOW = ['fabrary.net'];
  const baseOptions = { allowHosts: ALLOW, maxBytes: 1024, timeoutMs: 1000 };

  beforeEach(() => {
    service = new FetchGuardService();
    originalFetch = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function makeResponse(body: string, init: ResponseInit = {}): Response {
    return new Response(body, { status: 200, ...init });
  }

  it('returns the body when host is allow-listed (happy path)', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse('hello'));
    const result = await service.guardedFetch('https://fabrary.net/foo', baseOptions);
    expect(result.status).toBe(200);
    expect(new TextDecoder().decode(result.body)).toBe('hello');
  });

  it('follows a same-host redirect (allow-listed)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://fabrary.net/bar' } }))
      .mockResolvedValueOnce(makeResponse('after-redirect'));
    const result = await service.guardedFetch('https://fabrary.net/foo', baseOptions);
    expect(new TextDecoder().decode(result.body)).toBe('after-redirect');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws HOST_DENIED for non-allow-listed host', async () => {
    await expect(service.guardedFetch('https://evil.com/x', baseOptions)).rejects.toMatchObject({
      code: EFetchGuardErrorCode.HostDenied,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws REDIRECT_DENIED on cross-host redirect', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://evil.com/x' } }),
    );
    await expect(service.guardedFetch('https://fabrary.net/foo', baseOptions)).rejects.toMatchObject({
      code: EFetchGuardErrorCode.RedirectDenied,
    });
  });

  it('throws SIZE_EXCEEDED when response exceeds maxBytes', async () => {
    const big = 'x'.repeat(2000);
    fetchMock.mockResolvedValueOnce(makeResponse(big));
    await expect(
      service.guardedFetch('https://fabrary.net/foo', { ...baseOptions, maxBytes: 100 }),
    ).rejects.toMatchObject({ code: EFetchGuardErrorCode.SizeExceeded });
  });

  it('throws TIMEOUT when fetch is aborted', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    await expect(
      service.guardedFetch('https://fabrary.net/foo', { ...baseOptions, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: EFetchGuardErrorCode.Timeout });
  });

  it('throws InvalidUrl for malformed input', async () => {
    await expect(service.guardedFetch('not a url', baseOptions)).rejects.toBeInstanceOf(FetchGuardError);
  });
});

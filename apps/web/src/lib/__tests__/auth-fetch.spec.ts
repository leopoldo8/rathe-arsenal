import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authFetch, AuthFetchError } from '../auth-fetch';
import i18n from '../../i18n';

/**
 * T13 — authFetch must carry the active locale to the API via Accept-Language
 * and surface the stable error `code` from the envelope so the client can
 * localize the message (T14). Mirrors the fetch-stub pattern in
 * api-client.test.tsx.
 */
describe('authFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function requestHeaders(): Headers {
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    return new Headers(init?.headers);
  }

  it('sets Accept-Language to the active i18n locale', async () => {
    await authFetch('/x', {}, 'jwt');
    expect(requestHeaders().get('Accept-Language')).toBe(i18n.language);
  });

  it('populates AuthFetchError.code from the error envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(authFetch('/auth/sign-in', { method: 'POST' }, null)).rejects.toMatchObject({
      name: 'AuthFetchError',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('leaves code null when the envelope omits it', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const err = await authFetch('/x', {}, null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthFetchError);
    expect((err as AuthFetchError).code).toBeNull();
  });
});

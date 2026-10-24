import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authFetch, AuthFetchError } from '../auth-fetch';
import i18n from '../../i18n';
import { onUnauthorized } from '../session-events';

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
    await authFetch('/x');
    expect(requestHeaders().get('Accept-Language')).toBe(i18n.language);
  });

  it('requests carry no Authorization header', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    await authFetch('/x');
    await authFetch('/x', { method: 'POST', body: '{}' });
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    }
  });

  it('tells the auth provider when a request without an error code is refused with 401', async () => {
    const heard = vi.fn();
    const stop = onUnauthorized(heard);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid', code: 'INVALID_CREDENTIALS' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await authFetch('/lists').catch(() => undefined);
    expect(heard).toHaveBeenCalledTimes(1);
    await authFetch('/auth/sign-in', { method: 'POST' }).catch(() => undefined);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it('populates AuthFetchError.code from the error envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(authFetch('/auth/sign-in', { method: 'POST' })).rejects.toMatchObject({
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
    const err = await authFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthFetchError);
    expect((err as AuthFetchError).code).toBeNull();
  });
});

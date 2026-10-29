import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApiClient } from '../api-client';
import { onUnauthorized } from '../session-events';
import i18n from '../../i18n';

describe('useApiClient — Content-Type handling', () => {
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

  function getRequestHeaders(): Headers {
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    return new Headers(init?.headers);
  }

  it('sets Content-Type: application/json when body is a string and no header is supplied', async () => {
    const { result } = renderHook(() => useApiClient());
    await result.current('/test', { method: 'POST', body: '{"a":1}' });
    expect(getRequestHeaders().get('Content-Type')).toBe('application/json');
  });

  it('does NOT set Content-Type when body is FormData (browser sets multipart boundary)', async () => {
    const { result } = renderHook(() => useApiClient());
    const formData = new FormData();
    formData.append('file', new Blob(['name,quantity\n']), 'test.csv');
    await result.current('/test', { method: 'POST', body: formData });
    expect(getRequestHeaders().has('Content-Type')).toBe(false);
  });

  it('respects an explicit Content-Type passed via init.headers', async () => {
    const { result } = renderHook(() => useApiClient());
    await result.current('/test', {
      method: 'POST',
      body: '<xml/>',
      headers: { 'Content-Type': 'application/xml' },
    });
    expect(getRequestHeaders().get('Content-Type')).toBe('application/xml');
  });

  it('does not set Content-Type when there is no body (e.g. GET)', async () => {
    const { result } = renderHook(() => useApiClient());
    await result.current('/test');
    expect(getRequestHeaders().has('Content-Type')).toBe(false);
  });

  it('sets Accept-Language to the active i18n locale', async () => {
    const { result } = renderHook(() => useApiClient());
    await result.current('/test');
    expect(getRequestHeaders().get('Accept-Language')).toBe(i18n.language);
  });

  it('requests carry no Authorization header', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const { result } = renderHook(() => useApiClient());
    await result.current('/test');
    await result.current('/test', { method: 'POST', body: '{"a":1}' });
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    }
  });

  it('tells the auth provider when the guard refuses a request with 401, but not an auth route', async () => {
    const heard = vi.fn();
    const stop = onUnauthorized(heard);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid', code: 'INVALID_CREDENTIALS' }), { status: 401 }),
    );
    const { result } = renderHook(() => useApiClient());

    await result.current('/decks').catch(() => undefined);
    expect(heard).toHaveBeenCalledTimes(1);
    await result.current('/auth/sign-in').catch(() => undefined);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApiClient } from '../api-client';
import i18n from '../../i18n';

// useApiClient calls useAuth() internally; mock the hook so the test does not
// have to mount the AuthProvider.
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ token: 'fake-jwt' }),
}));

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
});

import { callGemini, TGeminiFetch } from '../gemini-client';
import { callOpenRouterRecommendation } from '../openrouter-recommendation-client';
import { PROVIDER_DETAIL_MAX_LENGTH, readProviderFailureDetail } from '../provider-failure-detail';

const REQUEST = { system: 'SECRET-SYSTEM-PROMPT', prompt: 'SECRET-USER-PROMPT' };
const KEY = 'sk-or-v1-abcdef1234567890';

function failing(status: number, text: string): TGeminiFetch {
  return async () => ({ ok: false, status, json: async () => JSON.parse(text), text: async () => text });
}

describe('readProviderFailureDetail', () => {
  it('uses the JSON error.message when present', async () => {
    const response = { status: 401, json: async () => ({}), text: async () => JSON.stringify({ error: { code: 401, message: 'User not found.' } }) };

    await expect(readProviderFailureDetail(response, {})).resolves.toBe('HTTP 401: User not found.');
  });

  it('falls back to the raw body when it is not JSON', async () => {
    const response = { status: 400, json: async () => { throw new Error('bad'); }, text: async () => '<html>Bad   gateway</html>' };

    await expect(readProviderFailureDetail(response, {})).resolves.toBe('HTTP 400: <html>Bad gateway</html>');
  });

  it('falls back to the raw body when error.message is missing', async () => {
    const response = { status: 400, json: async () => ({}), text: async () => '{"error":{"code":400}}' };

    await expect(readProviderFailureDetail(response, {})).resolves.toBe('HTTP 400: {"error":{"code":400}}');
  });

  it('returns only the status when the body is empty or unreadable', async () => {
    const empty = { status: 404, json: async () => ({}), text: async () => '' };
    const broken = { status: 404, json: async () => ({}), text: async () => { throw new Error('socket'); } };

    await expect(readProviderFailureDetail(empty, {})).resolves.toBe('HTTP 404');
    await expect(readProviderFailureDetail(broken, {})).resolves.toBe('HTTP 404');
  });

  it('truncates long messages', async () => {
    const response = { status: 400, json: async () => ({}), text: async () => JSON.stringify({ error: { message: 'x'.repeat(5000) } }) };

    const detail = await readProviderFailureDetail(response, {});

    expect(detail).toBe(`HTTP 400: ${'x'.repeat(PROVIDER_DETAIL_MAX_LENGTH)}`);
  });

  it('redacts header secrets that the provider echoes back', async () => {
    const response = { status: 401, json: async () => ({}), text: async () => JSON.stringify({ error: { message: `Invalid key ${KEY}` } }) };

    const detail = await readProviderFailureDetail(response, { Authorization: `Bearer ${KEY}` });

    expect(detail).toBe('HTTP 401: Invalid key [redacted]');
    expect(detail).not.toContain(KEY);
  });
});

describe('provider HTTP errors in the recommendation clients', () => {
  it('OpenRouter logs the provider message without the key or the prompt', async () => {
    const fetch = failing(401, JSON.stringify({ error: { message: `No auth credentials found for ${KEY}` } }));

    const outcome = await callOpenRouterRecommendation(KEY, 'google/gemini-3.8-flash', REQUEST, fetch);

    expect(outcome).toEqual({ kind: 'failed', code: 'PROVIDER_ERROR', detail: 'HTTP 401: No auth credentials found for [redacted]' });
    expect(JSON.stringify(outcome)).not.toMatch(/sk-or-v1|SECRET-/);
  });

  it('Gemini logs the provider message and keeps the error code', async () => {
    const fetch = failing(400, JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } }));

    const outcome = await callGemini('AIzaSyFAKEKEY1234567', REQUEST, fetch);

    expect(outcome).toEqual({ kind: 'failed', code: 'PROVIDER_ERROR', detail: 'HTTP 400: API key not valid. Please pass a valid API key.' });
  });

  it('still maps rate limits to a retry without reading the body', async () => {
    const outcome = await callGemini('AIzaSyFAKEKEY1234567', REQUEST, failing(429, '{}'));

    expect(outcome).toMatchObject({ kind: 'retry', code: 'RATE_LIMITED' });
  });
});

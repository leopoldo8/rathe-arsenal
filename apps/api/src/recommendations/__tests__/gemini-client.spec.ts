import { callGemini, GEMINI_TIMEOUT_MS, parseThinkingLevel, TGeminiFetch } from '../gemini-client';

const REQUEST = { system: 'system text', prompt: 'prompt text' };
const ANSWER = { recommendations: [{ card: 'adrenaline-rush-red', strength: 'consider', cut: '', reason: 'r', reason_pt_br: 'm' }] };

interface ICapturedCall {
  readonly url: string;
  readonly init: Parameters<TGeminiFetch>[1];
}

function respond(status: number, body: unknown = {}): { fetch: TGeminiFetch; calls: ICapturedCall[] } {
  const calls: ICapturedCall[] = [];
  const fetch: TGeminiFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { fetch, calls };
}

function answer(finishReason: string, text: string = JSON.stringify(ANSWER), extra: object = {}): unknown {
  return {
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 41000, candidatesTokenCount: 900, thoughtsTokenCount: 2100 },
    ...extra,
  };
}

describe('callGemini', () => {
  it('posts the documented generateContent request', async () => {
    const { fetch, calls } = respond(200, answer('STOP'));

    await callGemini('the-key', REQUEST, fetch);

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(init.method).toBe('POST');
    expect(init.headers['x-goog-api-key']).toBe('the-key');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'system text' }] });
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'prompt text' }] }]);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.maxOutputTokens).toBe(32000);
    const items = body.generationConfig.responseJsonSchema.properties.recommendations.items;
    expect(items.required).toEqual(['card', 'strength', 'cut', 'reason', 'reason_pt_br']);
    expect(items.properties.strength.enum).toEqual(['clear_upgrade', 'consider']);
    expect(body.generationConfig.responseJsonSchema.required).toEqual(['recommendations']);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('sends thinkingConfig.thinkingLevel only when a level is set', async () => {
    for (const level of ['low', 'medium', 'high'] as const) {
      const { fetch, calls } = respond(200, answer('STOP'));
      await callGemini('k', REQUEST, fetch, { thinkingLevel: level });
      expect({ level, config: JSON.parse(calls[0]!.init.body).generationConfig.thinkingConfig }).toEqual({ level, config: { thinkingLevel: level } });
    }
  });

  it('reads the thinking level from the environment value, ignoring anything else', () => {
    expect(['low', ' Medium ', 'HIGH', 'minimal', '', undefined].map(parseThinkingLevel)).toEqual(['low', 'medium', 'high', undefined, undefined, undefined]);
  });

  it('classifies every provider outcome', async () => {
    const cases: ReadonlyArray<[string, () => { fetch: TGeminiFetch }, object]> = [
      ['STOP with valid JSON', () => respond(200, answer('STOP')), {
        kind: 'answer',
        entries: ANSWER.recommendations,
        usage: { inputTokens: 41000, outputTokens: 3000 },
      }],
      ['429', () => respond(429), { kind: 'retry', status: 429, code: 'RATE_LIMITED' }],
      ['500', () => respond(500), { kind: 'retry', status: 500, code: 'PROVIDER_UNAVAILABLE' }],
      ['503', () => respond(503), { kind: 'retry', status: 503, code: 'PROVIDER_UNAVAILABLE' }],
      ['504', () => respond(504), { kind: 'retry', status: 504, code: 'PROVIDER_UNAVAILABLE' }],
      ['400', () => respond(400), { kind: 'failed', code: 'PROVIDER_ERROR' }],
      ['403', () => respond(403), { kind: 'failed', code: 'PROVIDER_ERROR' }],
      ['404', () => respond(404), { kind: 'failed', code: 'PROVIDER_ERROR' }],
      ['network failure', () => ({ fetch: async () => { throw new Error('socket hang up'); } }), { kind: 'failed', code: 'PROVIDER_ERROR' }],
      ['blockReason', () => respond(200, { promptFeedback: { blockReason: 'SAFETY' } }), { kind: 'failed', code: 'MODEL_REFUSED' }],
      ...['SAFETY', 'RECITATION', 'LANGUAGE', 'OTHER', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'FINISH_REASON_UNSPECIFIED', 'SPII'].map(
        (reason): [string, () => { fetch: TGeminiFetch }, object] => [
          `finishReason ${reason}`,
          () => respond(200, answer(reason)),
          { kind: 'failed', code: 'MODEL_REFUSED' },
        ],
      ),
      ['MAX_TOKENS', () => respond(200, answer('MAX_TOKENS')), { kind: 'failed', code: 'MODEL_TRUNCATED' }],
      ['not JSON', () => respond(200, answer('STOP', 'not json')), { kind: 'failed', code: 'MODEL_OFF_SCHEMA' }],
      ['wrong shape', () => respond(200, answer('STOP', '{"ranking":[]}')), { kind: 'failed', code: 'MODEL_OFF_SCHEMA' }],
    ];

    for (const [label, makeFetch, expected] of cases) {
      const outcome = await callGemini('k', REQUEST, makeFetch().fetch);
      expect({ label, outcome }).toEqual({ label, outcome: expect.objectContaining(expected) });
    }
  });

  it('aborts a call at 290 seconds', async () => {
    jest.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fetch: TGeminiFetch = (_url, init) => {
        signal = init.signal;
        return new Promise(() => undefined);
      };

      const pending = callGemini('k', REQUEST, fetch);
      await jest.advanceTimersByTimeAsync(GEMINI_TIMEOUT_MS - 1);
      expect(signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toEqual(expect.objectContaining({ kind: 'failed', code: 'MODEL_TIMEOUT' }));
      expect(signal?.aborted).toBe(true);
      expect(GEMINI_TIMEOUT_MS).toBe(290_000);
    } finally {
      jest.useRealTimers();
    }
  });
});

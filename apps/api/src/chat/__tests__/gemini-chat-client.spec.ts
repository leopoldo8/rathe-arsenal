import { TGeminiFetch } from '../../recommendations/gemini-client';
import { callGeminiChat, CHAT_RETRY_DELAYS_MS, classifyChatAnswer, IChatRequest, TChatCallOutcome, withProviderRetry } from '../gemini-chat-client';

const REQUEST: IChatRequest = { system: 's', contents: [{ role: 'user', parts: [{ text: 'hi' }] }], tools: [] };

function respond(status: number, body: unknown = {}): TGeminiFetch {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function answer(finishReason: string, parts: unknown[] = [{ text: 'x' }]): unknown {
  return { candidates: [{ finishReason, content: { role: 'model', parts } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, thoughtsTokenCount: 3 } };
}

describe('Gemini chat client', () => {
  it('classifies every provider outcome', async () => {
    const statuses: Array<[number, string]> = [
      [429, 'RATE_LIMITED'],
      [500, 'PROVIDER_UNAVAILABLE'],
      [503, 'PROVIDER_UNAVAILABLE'],
      [504, 'PROVIDER_UNAVAILABLE'],
      [400, 'PROVIDER_ERROR'],
      [403, 'PROVIDER_ERROR'],
      [404, 'PROVIDER_ERROR'],
    ];
    const outcomes = await Promise.all(statuses.map(([status]) => callGeminiChat('k', REQUEST, respond(status))));
    const rejected = await callGeminiChat('k', REQUEST, async () => {
      throw new Error('socket hang up');
    });

    expect(outcomes.map((outcome) => (outcome.kind === 'failed' ? outcome.code : 'answer'))).toEqual(statuses.map(([, code]) => code));
    expect(rejected).toEqual(expect.objectContaining({ kind: 'failed', code: 'PROVIDER_ERROR' }));
  });

  it('aborts a call at 120 seconds', async () => {
    jest.useFakeTimers();
    try {
      let aborted = false;
      const never: TGeminiFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        });
      const pending = callGeminiChat('k', REQUEST, never);

      await jest.advanceTimersByTimeAsync(119_999);
      expect(aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);

      expect(await pending).toEqual(expect.objectContaining({ kind: 'failed', code: 'MODEL_TIMEOUT' }));
      expect(aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('classifies every answer outcome', () => {
    const refused = ['SAFETY', 'RECITATION', 'LANGUAGE', 'OTHER', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'FINISH_REASON_UNSPECIFIED', 'UNEXPECTED_TOOL_CALL', 'MALFORMED_RESPONSE', 'SOMETHING_NEW'];
    const mapped: Array<[string, string]> = [
      ['MAX_TOKENS', 'MODEL_TRUNCATED'],
      ['MALFORMED_FUNCTION_CALL', 'MODEL_BAD_TOOL_CALL'],
      ['TOO_MANY_TOOL_CALLS', 'TOO_MANY_TOOL_ROUNDS'],
      ['MISSING_THOUGHT_SIGNATURE', 'HISTORY_REJECTED'],
    ];
    const code = (body: unknown) => {
      const outcome = classifyChatAnswer(body as never);
      return outcome.kind === 'failed' ? outcome.code : 'answer';
    };

    expect(code({ promptFeedback: { blockReason: 'SAFETY' } })).toBe('MODEL_REFUSED');
    expect(refused.map((reason) => code(answer(reason)))).toEqual(refused.map(() => 'MODEL_REFUSED'));
    expect(mapped.map(([reason]) => code(answer(reason)))).toEqual(mapped.map(([, expected]) => expected));
    expect(code(answer('STOP', [{ text: 'thinking', thought: true }]))).toBe('MODEL_EMPTY');
    expect(code(answer('STOP', [{ text: 'Katsu plays well.' }]))).toBe('answer');
    expect(code(answer('STOP', [{ functionCall: { name: 'get_deck', args: { deckId: 1 } } }]))).toBe('answer');
    const usage = classifyChatAnswer(answer('MAX_TOKENS') as never);
    expect(usage.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it('a refused call carries the provider message', async () => {
    const overloaded = await callGeminiChat('k', REQUEST, respond(503, { error: { code: 503, message: 'This model is currently experiencing high demand.' } }));
    const unreadable = await callGeminiChat('k', REQUEST, async () => ({
      ok: false,
      status: 503,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));

    expect(overloaded).toEqual({ kind: 'failed', code: 'PROVIDER_UNAVAILABLE', detail: 'HTTP 503: This model is currently experiencing high demand.' });
    expect(unreadable).toEqual({ kind: 'failed', code: 'PROVIDER_UNAVAILABLE', detail: 'HTTP 503' });
  });
});

describe('withProviderRetry', () => {
  const busy: TChatCallOutcome = { kind: 'failed', code: 'PROVIDER_UNAVAILABLE', detail: 'HTTP 503' };
  const limited: TChatCallOutcome = { kind: 'failed', code: 'RATE_LIMITED', detail: 'HTTP 429' };
  const done: TChatCallOutcome = { kind: 'answer', content: { role: 'model', parts: [{ text: 'ok' }] }, calls: [], text: 'ok', usage: { inputTokens: 1, outputTokens: 1 } };

  function scripted(outcomes: TChatCallOutcome[]): { call: () => Promise<TChatCallOutcome>; count: () => number } {
    let calls = 0;
    return { call: async () => outcomes[Math.min(calls++, outcomes.length - 1)]!, count: () => calls };
  }

  it('waits 2, 5 and 10 seconds between retries of an overloaded or rate-limited call', async () => {
    const slept: number[] = [];
    const retries: unknown[] = [];
    const script = scripted([busy, limited, busy, done]);

    const outcome = await withProviderRetry(script.call, { sleep: async (ms) => void slept.push(ms), onRetry: (retry) => void retries.push(retry) });

    expect(CHAT_RETRY_DELAYS_MS).toEqual([2_000, 5_000, 10_000]);
    expect(outcome).toBe(done);
    expect(script.count()).toBe(4);
    expect(slept).toEqual([2_000, 5_000, 10_000]);
    expect(retries).toEqual([
      { attempt: 1, code: 'PROVIDER_UNAVAILABLE', detail: 'HTTP 503', delayMs: 2_000 },
      { attempt: 2, code: 'RATE_LIMITED', detail: 'HTTP 429', delayMs: 5_000 },
      { attempt: 3, code: 'PROVIDER_UNAVAILABLE', detail: 'HTTP 503', delayMs: 10_000 },
    ]);
  });

  it('gives up after the third retry with the last failure', async () => {
    const script = scripted([busy]);

    const outcome = await withProviderRetry(script.call, { sleep: async () => undefined });

    expect(outcome).toBe(busy);
    expect(script.count()).toBe(4);
  });

  it('never retries an answer or any other failure', async () => {
    const others: TChatCallOutcome[] = [
      done,
      { kind: 'failed', code: 'PROVIDER_ERROR', detail: 'HTTP 400' },
      { kind: 'failed', code: 'MODEL_TIMEOUT', detail: 'no answer in 120000 ms' },
      { kind: 'failed', code: 'MODEL_REFUSED', detail: 'finishReason SAFETY', usage: { inputTokens: 5, outputTokens: 0 } },
    ];
    const slept: number[] = [];

    const counts = await Promise.all(
      others.map(async (other) => {
        const script = scripted([other, done]);
        expect(await withProviderRetry(script.call, { sleep: async (ms) => void slept.push(ms) })).toBe(other);
        return script.count();
      }),
    );

    expect(counts).toEqual([1, 1, 1, 1]);
    expect(slept).toEqual([]);
  });
});

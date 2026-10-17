import { TGeminiFetch } from '../gemini-client';
import { OPENROUTER_URL } from '../../chat/openrouter-chat-client';
import {
  buildOpenRouterRecommendationBody,
  callOpenRouterRecommendation,
  classifyOpenRouterRecommendation,
} from '../openrouter-recommendation-client';

const MODEL = 'openai/gpt-6-luna';
const REQUEST = { system: 'system text', prompt: 'prompt text' };
const ENTRY = { card: 'adrenaline-rush-red', strength: 'consider', cut: '', reason: 'r', reason_pt_br: 'm' };

function answer(content: string | null, finishReason = 'stop'): Record<string, unknown> {
  return { choices: [{ finish_reason: finishReason, message: { role: 'assistant', content } }], usage: { prompt_tokens: 36000, completion_tokens: 1800, cost: 0.0045 } };
}

function outcomeOf(json: Record<string, unknown>): string {
  const outcome = classifyOpenRouterRecommendation(json);
  return outcome.kind === 'answer' ? 'answer' : `${outcome.kind}:${outcome.code}`;
}

describe('OpenRouter recommendation client', () => {
  it('asks for the recommendation schema strictly, from a provider that honours it and keeps no data', () => {
    const body = buildOpenRouterRecommendationBody(MODEL, REQUEST, 'low');

    expect(body).toEqual({
      model: MODEL,
      messages: [
        { role: 'system', content: 'system text' },
        { role: 'user', content: 'prompt text' },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'recommendations', strict: true, schema: expect.objectContaining({ required: ['recommendations'] }) } },
      max_tokens: 32000,
      reasoning: { effort: 'low' },
      provider: { data_collection: 'deny', require_parameters: true },
    });
    expect(buildOpenRouterRecommendationBody(MODEL, REQUEST)['reasoning']).toBeUndefined();
  });

  it('reads the entries and the token usage from a finished answer', () => {
    expect(classifyOpenRouterRecommendation(answer(JSON.stringify({ recommendations: [ENTRY] })))).toEqual({
      kind: 'answer',
      entries: [ENTRY],
      usage: { inputTokens: 36000, outputTokens: 1800 },
    });
  });

  it('classifies every answer that is not usable', () => {
    expect(outcomeOf(answer('{"recommendations":[]', 'length'))).toBe('failed:MODEL_TRUNCATED');
    expect(outcomeOf(answer(null, 'content_filter'))).toBe('failed:MODEL_REFUSED');
    expect(outcomeOf({ choices: [{ finish_reason: 'stop', message: { content: null, refusal: 'no' } }] })).toBe('failed:MODEL_REFUSED');
    expect(outcomeOf(answer('not json'))).toBe('failed:MODEL_OFF_SCHEMA');
    expect(outcomeOf(answer('{"cards":[]}'))).toBe('failed:MODEL_OFF_SCHEMA');
    expect(outcomeOf({ choices: [] })).toBe('failed:MODEL_OFF_SCHEMA');
    expect(outcomeOf({ error: { code: 429, message: 'slow down' } })).toBe('retry:RATE_LIMITED');
    expect(outcomeOf({ error: { code: 502, message: 'upstream' } })).toBe('retry:PROVIDER_UNAVAILABLE');
    expect(outcomeOf({ error: { code: 402, message: 'credits' } })).toBe('failed:PROVIDER_ERROR');
  });

  it('posts to OpenRouter with the key as a bearer token, retries what can recover and fails the rest', async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const ok: TGeminiFetch = async (url, init) => {
      seen.push({ url, headers: init.headers });
      return { ok: true, status: 200, json: async () => answer(JSON.stringify({ recommendations: [ENTRY] })) };
    };
    const status = (code: number): TGeminiFetch => async () => ({ ok: false, status: code, json: async () => ({ error: { message: 'm' } }) });

    const outcome = await callOpenRouterRecommendation('key', MODEL, REQUEST, ok);
    const failures = await Promise.all([429, 502, 402].map((code) => callOpenRouterRecommendation('key', MODEL, REQUEST, status(code))));

    expect(outcome.kind).toBe('answer');
    expect(seen).toEqual([{ url: OPENROUTER_URL, headers: expect.objectContaining({ Authorization: 'Bearer key', 'Content-Type': 'application/json' }) }]);
    expect(failures.map((failure) => (failure.kind === 'answer' ? 'answer' : `${failure.kind}:${failure.code}`))).toEqual([
      'retry:RATE_LIMITED',
      'retry:PROVIDER_UNAVAILABLE',
      'failed:PROVIDER_ERROR',
    ]);
  });
});

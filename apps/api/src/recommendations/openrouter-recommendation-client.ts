import { TRecommendationFailureCode } from '../database/entities/recommendation-run.entity';
import { OPENROUTER_URL } from '../chat/openrouter-chat-client';
import {
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_TIMEOUT_MS,
  IGeminiCallOptions,
  parseEntries,
  postRecommendation,
  RECOMMENDATION_SCHEMA,
  RETRYABLE_STATUSES,
  TGeminiFetch,
  TGeminiOutcome,
  TGeminiThinkingLevel,
} from './gemini-client';
import { IRecommendationPrompt } from './recommendation-prompt';

const PROVIDER_MESSAGE_MAX_LENGTH = 300;

interface IOpenRouterResponse {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { code?: number | string; message?: string };
}

export function buildOpenRouterRecommendationBody(
  model: string,
  request: IRecommendationPrompt,
  effort?: TGeminiThinkingLevel,
): Record<string, unknown> {
  return {
    model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'recommendations', strict: true, schema: RECOMMENDATION_SCHEMA } },
    max_tokens: GEMINI_MAX_OUTPUT_TOKENS,
    ...(effort === undefined ? {} : { reasoning: { effort } }),
    provider: { data_collection: 'deny', require_parameters: true },
  };
}

const FINISH_FAILURES: ReadonlyMap<string, TRecommendationFailureCode> = new Map([
  ['length', 'MODEL_TRUNCATED'],
  ['content_filter', 'MODEL_REFUSED'],
  ['error', 'PROVIDER_ERROR'],
]);

export function classifyOpenRouterRecommendation(json: IOpenRouterResponse): TGeminiOutcome {
  if (json.error) {
    const status = Number(json.error.code);
    const retryCode = RETRYABLE_STATUSES.get(status);
    if (retryCode) return { kind: 'retry', status, code: retryCode };
    const detail = `error ${json.error.code ?? 'unknown'}: ${(json.error.message ?? '').slice(0, PROVIDER_MESSAGE_MAX_LENGTH)}`;
    return { kind: 'failed', code: 'PROVIDER_ERROR', detail };
  }
  const choice = json.choices?.[0];
  const finishReason = choice?.finish_reason ?? 'unknown';
  const failure = FINISH_FAILURES.get(finishReason);
  if (failure) return { kind: 'failed', code: failure, detail: `finish_reason ${finishReason}` };
  if (choice?.message?.refusal) return { kind: 'failed', code: 'MODEL_REFUSED', detail: choice.message.refusal.slice(0, PROVIDER_MESSAGE_MAX_LENGTH) };

  const entries = parseEntries(choice?.message?.content ?? '');
  if (entries === null) return { kind: 'failed', code: 'MODEL_OFF_SCHEMA', detail: 'no recommendations array' };
  const usage = json.usage ?? {};
  return {
    kind: 'answer',
    entries,
    usage: { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 },
  };
}

export function callOpenRouterRecommendation(
  apiKey: string,
  model: string,
  request: IRecommendationPrompt,
  fetchImpl: TGeminiFetch,
  options: IGeminiCallOptions = {},
): Promise<TGeminiOutcome> {
  return postRecommendation(
    {
      url: OPENROUTER_URL,
      headers: { Authorization: `Bearer ${apiKey}`, 'X-Title': 'Rathe Arsenal' },
      body: buildOpenRouterRecommendationBody(model, request, options.thinkingLevel),
      classify: (json) => classifyOpenRouterRecommendation(json as IOpenRouterResponse),
    },
    fetchImpl,
    options.timeoutMs ?? GEMINI_TIMEOUT_MS,
  );
}

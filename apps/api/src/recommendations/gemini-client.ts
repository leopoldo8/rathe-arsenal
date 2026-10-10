import { TRecommendationFailureCode } from '../database/entities/recommendation-run.entity';
import { IRecommendationPrompt } from './recommendation-prompt';

export const GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const GEMINI_MAX_OUTPUT_TOKENS = 32000;
/** Below the 300 s Node's fetch waits for response headers, so the abort, not the socket, decides. */
export const GEMINI_TIMEOUT_MS = 290_000;

export const GEMINI_THINKING_LEVELS = ['low', 'medium', 'high'] as const;
export type TGeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];

export interface IGeminiCallOptions {
  readonly timeoutMs?: number;
  readonly thinkingLevel?: TGeminiThinkingLevel | undefined;
}

export function parseThinkingLevel(value: string | undefined): TGeminiThinkingLevel | undefined {
  const normalized = value?.trim().toLowerCase();
  return (GEMINI_THINKING_LEVELS as readonly string[]).includes(normalized ?? '') ? (normalized as TGeminiThinkingLevel) : undefined;
}

export type TGeminiFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface IGeminiEntry {
  readonly card: string;
  readonly strength: string;
  readonly cut: string;
  readonly reason: string;
  readonly reason_pt_br: string;
}

export interface IGeminiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type TGeminiOutcome =
  | { readonly kind: 'answer'; readonly entries: readonly IGeminiEntry[]; readonly usage: IGeminiUsage }
  | { readonly kind: 'retry'; readonly status: number; readonly code: TRecommendationFailureCode }
  | { readonly kind: 'failed'; readonly code: TRecommendationFailureCode; readonly detail: string };

export const RECOMMENDATION_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          card: { type: 'string' },
          strength: { type: 'string', enum: ['clear_upgrade', 'consider'] },
          cut: { type: 'string' },
          reason: { type: 'string' },
          reason_pt_br: { type: 'string' },
        },
        required: ['card', 'strength', 'cut', 'reason', 'reason_pt_br'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
} as const;

/**
 * Request body of `models.generateContent`, per https://ai.google.dev/api/generate-content; `thinkingConfig` per
 * https://ai.google.dev/gemini-api/docs/generate-content/thinking (Gemini 3.8 Flash: low, medium by default, high).
 */
export function buildGeminiBody(request: IRecommendationPrompt, thinkingLevel?: TGeminiThinkingLevel): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: RECOMMENDATION_SCHEMA,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      ...(thinkingLevel === undefined ? {} : { thinkingConfig: { thinkingLevel } }),
    },
  };
}

interface IGenerateContentResponse {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

const RETRYABLE_STATUSES: ReadonlyMap<number, TRecommendationFailureCode> = new Map([
  [429, 'RATE_LIMITED'],
  [500, 'PROVIDER_UNAVAILABLE'],
  [503, 'PROVIDER_UNAVAILABLE'],
  [504, 'PROVIDER_UNAVAILABLE'],
]);

function parseEntries(text: string): readonly IGeminiEntry[] | null {
  try {
    const parsed = JSON.parse(text) as { recommendations?: unknown };
    if (!Array.isArray(parsed.recommendations)) return null;
    return parsed.recommendations.filter(
      (entry): entry is IGeminiEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as IGeminiEntry).card === 'string' &&
        typeof (entry as IGeminiEntry).strength === 'string' &&
        typeof (entry as IGeminiEntry).reason === 'string',
    ).map((entry) => ({
      ...entry,
      cut: typeof entry.cut === 'string' ? entry.cut : '',
      reason_pt_br: typeof entry.reason_pt_br === 'string' ? entry.reason_pt_br : '',
    }));
  } catch {
    return null;
  }
}

function classifyAnswer(json: IGenerateContentResponse): TGeminiOutcome {
  if (json.promptFeedback?.blockReason) {
    return { kind: 'failed', code: 'MODEL_REFUSED', detail: `blockReason ${json.promptFeedback.blockReason}` };
  }
  const candidate = json.candidates?.[0];
  const finishReason = candidate?.finishReason ?? 'FINISH_REASON_UNSPECIFIED';
  if (finishReason === 'MAX_TOKENS') return { kind: 'failed', code: 'MODEL_TRUNCATED', detail: finishReason };
  if (finishReason !== 'STOP') return { kind: 'failed', code: 'MODEL_REFUSED', detail: `finishReason ${finishReason}` };

  const text = (candidate?.content?.parts ?? [])
    .filter((part) => part.thought !== true)
    .map((part) => part.text ?? '')
    .join('');
  const entries = parseEntries(text);
  if (entries === null) return { kind: 'failed', code: 'MODEL_OFF_SCHEMA', detail: 'no recommendations array' };

  const usage = json.usageMetadata ?? {};
  return {
    kind: 'answer',
    entries,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    },
  };
}

export async function callGemini(
  apiKey: string,
  request: IRecommendationPrompt,
  fetchImpl: TGeminiFetch,
  options: IGeminiCallOptions = {},
): Promise<TGeminiOutcome> {
  const timeoutMs = options.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<TGeminiOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: 'failed', code: 'MODEL_TIMEOUT', detail: `no answer in ${timeoutMs} ms` });
    }, timeoutMs);
  });
  const answered = (async (): Promise<TGeminiOutcome> => {
    try {
      const response = await fetchImpl(GEMINI_URL, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGeminiBody(request, options.thinkingLevel)),
        signal: controller.signal,
      });
      const retryCode = RETRYABLE_STATUSES.get(response.status);
      if (retryCode) return { kind: 'retry', status: response.status, code: retryCode };
      if (!response.ok) return { kind: 'failed', code: 'PROVIDER_ERROR', detail: `HTTP ${response.status}` };
      return classifyAnswer((await response.json()) as IGenerateContentResponse);
    } catch (error) {
      return { kind: 'failed', code: 'PROVIDER_ERROR', detail: (error as Error).message };
    }
  })();
  try {
    return await Promise.race([answered, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

import { GEMINI_MODEL, GEMINI_URL, TGeminiFetch, TGeminiThinkingLevel } from '../recommendations/gemini-client';
import { TChatTurnFailureCode } from '../database/entities/chat-message.entity';

export const CHAT_MODEL = GEMINI_MODEL;
export const CHAT_CALL_TIMEOUT_MS = 120_000;
export const CHAT_MAX_OUTPUT_TOKENS = 16_000;
// Google answers 503 "high demand" and 429 in short spikes and asks callers to retry with a growing wait.
export const CHAT_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000, 10_000];
const PROVIDER_MESSAGE_MAX_LENGTH = 300;
const TOOL_RESULT_AS_TEXT_MAX = 12_000;

export interface IGeminiPart {
  readonly text?: string;
  readonly thought?: boolean;
  readonly thoughtSignature?: string;
  readonly functionCall?: { readonly id?: string; readonly name: string; readonly args?: Record<string, unknown> };
  readonly functionResponse?: { readonly id?: string; readonly name: string; readonly response: Record<string, unknown> };
  readonly [key: string]: unknown;
}

export interface IGeminiContent {
  readonly role: 'user' | 'model';
  readonly parts: readonly IGeminiPart[];
}

export interface IFunctionDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parametersJsonSchema: Record<string, unknown>;
}

export interface IChatRequest {
  readonly system: string;
  readonly contents: readonly IGeminiContent[];
  readonly tools: readonly IFunctionDeclaration[];
  readonly answerNow?: boolean;
}

export const ANSWER_NOW_INSTRUCTION =
  'You cannot call more tools for this answer. Answer the user now from what the tools already returned, and say plainly what you could not find or check.';

export interface IChatUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface IFunctionCall {
  readonly id: string | undefined;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export type TChatCallOutcome =
  | {
      readonly kind: 'answer';
      readonly content: IGeminiContent;
      readonly calls: readonly IFunctionCall[];
      readonly text: string;
      readonly usage: IChatUsage;
    }
  | { readonly kind: 'failed'; readonly code: TChatTurnFailureCode; readonly detail: string; readonly usage?: IChatUsage };

interface IGenerateContentResponse {
  candidates?: { finishReason?: string; content?: IGeminiContent }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

const FINISH_FAILURES: ReadonlyMap<string, TChatTurnFailureCode> = new Map([
  ['MAX_TOKENS', 'MODEL_TRUNCATED'],
  ['MALFORMED_FUNCTION_CALL', 'MODEL_BAD_TOOL_CALL'],
  ['TOO_MANY_TOOL_CALLS', 'TOO_MANY_TOOL_ROUNDS'],
  ['MISSING_THOUGHT_SIGNATURE', 'HISTORY_REJECTED'],
]);

function partAsText(part: IGeminiPart): IGeminiPart | null {
  if (part.thought === true) return null;
  if (part.functionCall) return { text: `(called ${part.functionCall.name} with ${JSON.stringify(part.functionCall.args ?? {})})` };
  if (part.functionResponse) {
    return { text: `(${part.functionResponse.name} returned ${JSON.stringify(part.functionResponse.response).slice(0, TOOL_RESULT_AS_TEXT_MAX)})` };
  }
  return typeof part.text === 'string' ? { text: part.text } : null;
}

// gemini-3.8-flash kept emitting tool calls after many tool rounds even with no tool declared; plain text history stops it.
function historyAsText(contents: readonly IGeminiContent[]): IGeminiContent[] {
  const flat = contents
    .map((content) => ({ role: content.role, parts: content.parts.map(partAsText).filter((part): part is IGeminiPart => part !== null) }))
    .filter((content) => content.parts.length > 0);
  const last = flat[flat.length - 1];
  if (last?.role === 'user') return [...flat.slice(0, -1), { role: 'user', parts: [...last.parts, { text: ANSWER_NOW_INSTRUCTION }] }];
  return [...flat, { role: 'user', parts: [{ text: ANSWER_NOW_INSTRUCTION }] }];
}

export function buildChatBody(request: IChatRequest, thinkingLevel?: TGeminiThinkingLevel): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: request.answerNow ? `${request.system}\n\n${ANSWER_NOW_INSTRUCTION}` : request.system }] },
    contents: request.answerNow ? historyAsText(request.contents) : request.contents,
    ...(request.answerNow ? {} : { tools: [{ functionDeclarations: request.tools }] }),
    generationConfig: {
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      ...(thinkingLevel === undefined ? {} : { thinkingConfig: { thinkingLevel } }),
    },
  };
}

const RETRYABLE_CODES: ReadonlySet<TChatTurnFailureCode> = new Set(['RATE_LIMITED', 'PROVIDER_UNAVAILABLE']);

export interface IProviderRetry {
  readonly attempt: number;
  readonly code: TChatTurnFailureCode;
  readonly detail: string;
  readonly delayMs: number;
}

export interface IProviderRetryOptions {
  readonly sleep?: ((ms: number) => Promise<void>) | undefined;
  readonly onRetry?: (retry: IProviderRetry) => void | Promise<void>;
}

function sleepFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withProviderRetry(call: () => Promise<TChatCallOutcome>, options: IProviderRetryOptions = {}): Promise<TChatCallOutcome> {
  const sleep = options.sleep ?? sleepFor;
  let outcome = await call();
  for (const [index, delayMs] of CHAT_RETRY_DELAYS_MS.entries()) {
    if (outcome.kind !== 'failed' || !RETRYABLE_CODES.has(outcome.code)) return outcome;
    await options.onRetry?.({ attempt: index + 1, code: outcome.code, detail: outcome.detail, delayMs });
    await sleep(delayMs);
    outcome = await call();
  }
  return outcome;
}

async function readFailureDetail(response: { status: number; json(): Promise<unknown> }): Promise<string> {
  const status = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: { message?: unknown } } | null;
    const message = body?.error?.message;
    return typeof message === 'string' ? `${status}: ${message.slice(0, PROVIDER_MESSAGE_MAX_LENGTH)}` : status;
  } catch {
    return status;
  }
}

function classifyStatus(status: number): TChatTurnFailureCode {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 500 || status === 503 || status === 504) return 'PROVIDER_UNAVAILABLE';
  return 'PROVIDER_ERROR';
}

export function classifyChatAnswer(json: IGenerateContentResponse): TChatCallOutcome {
  const metadata = json.usageMetadata ?? {};
  const usage = {
    inputTokens: metadata.promptTokenCount ?? 0,
    outputTokens: (metadata.candidatesTokenCount ?? 0) + (metadata.thoughtsTokenCount ?? 0),
  };
  if (json.promptFeedback?.blockReason) {
    return { kind: 'failed', code: 'MODEL_REFUSED', detail: `blockReason ${json.promptFeedback.blockReason}`, usage };
  }
  const candidate = json.candidates?.[0];
  const finishReason = candidate?.finishReason ?? 'FINISH_REASON_UNSPECIFIED';
  if (finishReason !== 'STOP') {
    return { kind: 'failed', code: FINISH_FAILURES.get(finishReason) ?? 'MODEL_REFUSED', detail: `finishReason ${finishReason}`, usage };
  }
  const content: IGeminiContent = { role: 'model', parts: candidate?.content?.parts ?? [] };
  const calls = content.parts
    .filter((part) => part.functionCall !== undefined)
    .map((part) => ({ id: part.functionCall!.id, name: part.functionCall!.name, args: part.functionCall!.args ?? {} }));
  const text = content.parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
  if (calls.length === 0 && text === '') return { kind: 'failed', code: 'MODEL_EMPTY', detail: 'no text and no call', usage };
  return { kind: 'answer', content, calls, text, usage };
}

export async function callGeminiChat(
  apiKey: string,
  request: IChatRequest,
  fetchImpl: TGeminiFetch,
  options: { readonly timeoutMs?: number; readonly thinkingLevel?: TGeminiThinkingLevel | undefined } = {},
): Promise<TChatCallOutcome> {
  const timeoutMs = options.timeoutMs ?? CHAT_CALL_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<TChatCallOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ kind: 'failed', code: 'MODEL_TIMEOUT', detail: `no answer in ${timeoutMs} ms` });
    }, timeoutMs);
  });
  const answered = (async (): Promise<TChatCallOutcome> => {
    try {
      const response = await fetchImpl(GEMINI_URL, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChatBody(request, options.thinkingLevel)),
        signal: controller.signal,
      });
      if (!response.ok) return { kind: 'failed', code: classifyStatus(response.status), detail: await readFailureDetail(response) };
      return classifyChatAnswer((await response.json()) as IGenerateContentResponse);
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

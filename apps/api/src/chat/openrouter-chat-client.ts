import { TGeminiFetch, TGeminiThinkingLevel } from '../recommendations/gemini-client';
import { TChatTurnFailureCode } from '../database/entities/chat-message.entity';
import {
  ANSWER_NOW_INSTRUCTION,
  CHAT_MAX_OUTPUT_TOKENS,
  historyAsText,
  IChatRequest,
  IChatUsage,
  IGeminiContent,
  IGeminiPart,
  postChat,
  TChatCallOutcome,
} from './gemini-chat-client';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PROVIDER_MESSAGE_MAX_LENGTH = 300;

interface IToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

export type TOpenRouterMessage =
  | { readonly role: 'system' | 'user'; readonly content: string }
  | { readonly role: 'assistant'; readonly content: string | null; readonly tool_calls?: readonly IToolCall[]; readonly reasoning_details?: unknown }
  | { readonly role: 'tool'; readonly tool_call_id: string; readonly content: string };

interface IOpenRouterResponse {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | { type?: string; text?: string }[] | null; tool_calls?: IToolCall[]; reasoning_details?: unknown[] };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; cost?: number };
  error?: { code?: number | string; message?: string };
}

function textOf(parts: readonly IGeminiPart[]): string {
  return parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

// Gemini may store calls without ids; each response without one answers the oldest unanswered call, in order.
export function toOpenRouterMessages(system: string, contents: readonly IGeminiContent[]): TOpenRouterMessage[] {
  const messages: TOpenRouterMessage[] = [{ role: 'system', content: system }];
  const unanswered: string[] = [];
  contents.forEach((content, contentIndex) => {
    if (content.role === 'model') {
      const toolCalls = content.parts.flatMap((part, partIndex): IToolCall[] => {
        if (!part.functionCall) return [];
        const id = part.functionCall.id ?? `call_${contentIndex}_${partIndex}`;
        unanswered.push(id);
        return [{ id, type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args ?? {}) } }];
      });
      const reasoning = content.parts.find((part) => part.reasoningDetails !== undefined)?.reasoningDetails;
      const text = textOf(content.parts);
      if (toolCalls.length === 0 && text === '') return;
      messages.push({
        role: 'assistant',
        content: text === '' ? null : text,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        ...(reasoning === undefined ? {} : { reasoning_details: reasoning }),
      });
      return;
    }
    for (const part of content.parts) {
      if (!part.functionResponse) continue;
      const id = part.functionResponse.id ?? unanswered[0] ?? `call_${contentIndex}`;
      const answered = unanswered.indexOf(id);
      if (answered >= 0) unanswered.splice(answered, 1);
      messages.push({ role: 'tool', tool_call_id: id, content: JSON.stringify(part.functionResponse.response) });
    }
    const text = textOf(content.parts);
    if (text !== '') messages.push({ role: 'user', content: text });
  });
  return messages;
}

export function buildOpenRouterBody(model: string, request: IChatRequest, effort?: TGeminiThinkingLevel): Record<string, unknown> {
  const system = request.answerNow ? `${request.system}\n\n${ANSWER_NOW_INSTRUCTION}` : request.system;
  return {
    model,
    messages: toOpenRouterMessages(system, request.answerNow ? historyAsText(request.contents) : request.contents),
    ...(request.answerNow
      ? {}
      : {
          tools: request.tools.map((tool) => ({
            type: 'function',
            function: { name: tool.name, description: tool.description, parameters: tool.parametersJsonSchema },
          })),
        }),
    max_tokens: CHAT_MAX_OUTPUT_TOKENS,
    ...(effort === undefined ? {} : { reasoning: { effort } }),
    provider: { data_collection: 'deny' },
  };
}

function failedFromError(error: { code?: number | string; message?: string }, usage?: IChatUsage): TChatCallOutcome {
  const status = Number(error.code);
  const code: TChatTurnFailureCode =
    status === 429 ? 'RATE_LIMITED' : status === 408 ? 'MODEL_TIMEOUT' : status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_ERROR';
  const detail = `error ${error.code ?? 'unknown'}: ${(error.message ?? '').slice(0, PROVIDER_MESSAGE_MAX_LENGTH)}`;
  return { kind: 'failed', code, detail, ...(usage ? { usage } : {}) };
}

function readUsage(json: IOpenRouterResponse): IChatUsage {
  const usage = json.usage ?? {};
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    cachedInputTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    ...(typeof usage.cost === 'number' ? { costUsd: usage.cost } : {}),
  };
}

const FINISH_FAILURES: ReadonlyMap<string, TChatTurnFailureCode> = new Map([
  ['length', 'MODEL_TRUNCATED'],
  ['content_filter', 'MODEL_REFUSED'],
  ['error', 'PROVIDER_ERROR'],
]);

function parseArguments(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw === '' ? '{}' : raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function classifyOpenRouterAnswer(json: IOpenRouterResponse): TChatCallOutcome {
  const usage = readUsage(json);
  if (json.error) return failedFromError(json.error, usage);
  const choice = json.choices?.[0];
  if (!choice?.message) return { kind: 'failed', code: 'MODEL_EMPTY', detail: 'no choice', usage };
  const finishReason = choice.finish_reason ?? 'unknown';
  const failure = FINISH_FAILURES.get(finishReason);
  if (failure) return { kind: 'failed', code: failure, detail: `finish_reason ${finishReason}`, usage };

  const message = choice.message;
  const calls = [];
  for (const call of message.tool_calls ?? []) {
    const args = parseArguments(call.function.arguments);
    if (args === null) return { kind: 'failed', code: 'MODEL_BAD_TOOL_CALL', detail: `arguments of ${call.function.name} are not a JSON object`, usage };
    calls.push({ id: call.id, name: call.function.name, args });
  }
  const content = message.content;
  const text = (typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join('')).trim();
  if (calls.length === 0 && text === '') return { kind: 'failed', code: 'MODEL_EMPTY', detail: 'no text and no call', usage };

  const parts: IGeminiPart[] = [
    ...(message.reasoning_details?.length ? [{ reasoningDetails: message.reasoning_details }] : []),
    ...(text === '' ? [] : [{ text }]),
    ...calls.map((call) => ({ functionCall: call })),
  ];
  return { kind: 'answer', content: { role: 'model', parts }, calls, text, usage };
}

export function callOpenRouterChat(
  apiKey: string,
  model: string,
  request: IChatRequest,
  fetchImpl: TGeminiFetch,
  options: { readonly timeoutMs?: number; readonly effort?: TGeminiThinkingLevel | undefined } = {},
): Promise<TChatCallOutcome> {
  return postChat(
    {
      url: OPENROUTER_URL,
      headers: { Authorization: `Bearer ${apiKey}`, 'X-Title': 'Rathe Arsenal' },
      body: buildOpenRouterBody(model, request, options.effort),
      classify: (json) => classifyOpenRouterAnswer(json as IOpenRouterResponse),
    },
    fetchImpl,
    options.timeoutMs,
  );
}

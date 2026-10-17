import { TChatTurnFailureCode } from '../database/entities/chat-message.entity';
import { CHAT_TOOL_DECLARATIONS, TToolResult, UnknownTool } from './chat-tools';
import { IChatRequest, IChatUsage, IGeminiContent, IGeminiPart, TChatCallOutcome } from './gemini-chat-client';

export const MAX_MODEL_CALLS = 5;
export const TURN_DEADLINE_MS = 480_000;
export const ANSWER_RESERVE_MS = 200_000;

export interface ITurnDeps {
  readonly system: string;
  readonly history: readonly IGeminiContent[];
  readonly call: (request: IChatRequest) => Promise<TChatCallOutcome>;
  /** Called after every model call that returned usage, before the answer is acted on. */
  readonly recordUsage: (usage: IChatUsage) => Promise<void>;
  readonly runTool: (name: string, args: Record<string, unknown>) => Promise<TToolResult>;
  readonly now: () => number;
  readonly onTool?: (name: string, durationMs: number) => void;
}

export type TTurnResult =
  | { readonly kind: 'done'; readonly text: string; readonly contents: readonly IGeminiContent[]; readonly usage: IChatUsage; readonly calls: number }
  | { readonly kind: 'failed'; readonly code: TChatTurnFailureCode; readonly detail: string; readonly usage: IChatUsage; readonly calls: number };

export const REPEATED_CALL_NOTE = 'You already made this exact call in this answer; its result is above. Use it instead of calling again.';

// A stored call with no response would make the next turn's history invalid.
function textOnly(content: IGeminiContent): IGeminiContent {
  return { ...content, parts: content.parts.filter((part) => part.functionCall === undefined) };
}

function addUsage(total: IChatUsage, call: IChatUsage): IChatUsage {
  return {
    inputTokens: total.inputTokens + call.inputTokens,
    outputTokens: total.outputTokens + call.outputTokens,
    cachedInputTokens: (total.cachedInputTokens ?? 0) + (call.cachedInputTokens ?? 0),
  };
}

export async function runTurn(deps: ITurnDeps): Promise<TTurnResult> {
  const startedAt = deps.now();
  const contents: IGeminiContent[] = [];
  let usage: IChatUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  let calls = 0;
  const failed = (code: TChatTurnFailureCode, detail: string): TTurnResult => ({ kind: 'failed', code, detail, usage, calls });

  const callsMade = new Set<string>();
  let mustAnswer = false;
  let finalRetried = false;
  let firstCallRetried = false;
  while (true) {
    const elapsed = deps.now() - startedAt;
    if (elapsed >= TURN_DEADLINE_MS) return failed('TURN_TIMEOUT', `${elapsed} ms`);
    const answerNow = mustAnswer || calls === MAX_MODEL_CALLS - 1 || elapsed >= TURN_DEADLINE_MS - ANSWER_RESERVE_MS;

    const outcome = await deps.call({
      system: deps.system,
      contents: [...deps.history, ...contents],
      tools: CHAT_TOOL_DECLARATIONS,
      ...(answerNow ? { answerNow: true } : {}),
    });
    calls += 1;
    if (outcome.usage) {
      await deps.recordUsage(outcome.usage);
      usage = addUsage(usage, outcome.usage);
    }
    if (outcome.kind === 'failed') {
      const timedOut = outcome.code === 'MODEL_TIMEOUT' && !answerNow;
      if (timedOut && contents.length > 0) {
        mustAnswer = true;
        continue;
      }
      if (timedOut && !firstCallRetried) {
        firstCallRetried = true;
        continue;
      }
      return failed(outcome.code, outcome.detail);
    }

    if (outcome.calls.length === 0) return { kind: 'done', text: outcome.text, contents: [...contents, outcome.content], usage, calls };
    if (answerNow) {
      if (outcome.text !== '') return { kind: 'done', text: outcome.text, contents: [...contents, textOnly(outcome.content)], usage, calls };
      if (finalRetried) return failed('TOO_MANY_TOOL_ROUNDS', `${calls} model calls`);
      finalRetried = true;
      mustAnswer = true;
      continue;
    }
    contents.push(outcome.content);

    const responses: IGeminiPart[] = [];
    for (const call of outcome.calls) {
      const key = `${call.name}:${JSON.stringify(call.args)}`;
      if (callsMade.has(key)) {
        responses.push({ functionResponse: { ...(call.id === undefined ? {} : { id: call.id }), name: call.name, response: { note: REPEATED_CALL_NOTE } } });
        continue;
      }
      callsMade.add(key);
      const toolStarted = deps.now();
      let response: TToolResult;
      try {
        response = await deps.runTool(call.name, call.args);
      } catch (error) {
        if (error instanceof UnknownTool) return failed('MODEL_BAD_TOOL_CALL', `undeclared function ${call.name}`);
        throw error;
      }
      deps.onTool?.(call.name, deps.now() - toolStarted);
      responses.push({ functionResponse: { ...(call.id === undefined ? {} : { id: call.id }), name: call.name, response } });
    }
    contents.push({ role: 'user', parts: responses });
  }
}

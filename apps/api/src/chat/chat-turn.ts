import { TChatTurnFailureCode } from '../database/entities/chat-message.entity';
import { CHAT_TOOL_DECLARATIONS, TToolResult, UnknownTool } from './chat-tools';
import { IChatRequest, IChatUsage, IGeminiContent, IGeminiPart, TChatCallOutcome } from './gemini-chat-client';

export const MAX_MODEL_CALLS = 6;
export const TURN_DEADLINE_MS = 480_000;

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

export async function runTurn(deps: ITurnDeps): Promise<TTurnResult> {
  const startedAt = deps.now();
  const contents: IGeminiContent[] = [];
  let usage: IChatUsage = { inputTokens: 0, outputTokens: 0 };
  let calls = 0;
  const failed = (code: TChatTurnFailureCode, detail: string): TTurnResult => ({ kind: 'failed', code, detail, usage, calls });

  while (true) {
    if (calls >= MAX_MODEL_CALLS) return failed('TOO_MANY_TOOL_ROUNDS', `${calls} model calls`);
    if (deps.now() - startedAt >= TURN_DEADLINE_MS) return failed('TURN_TIMEOUT', `${deps.now() - startedAt} ms`);

    const outcome = await deps.call({ system: deps.system, contents: [...deps.history, ...contents], tools: CHAT_TOOL_DECLARATIONS });
    calls += 1;
    if (outcome.usage) {
      await deps.recordUsage(outcome.usage);
      usage = {
        inputTokens: usage.inputTokens + outcome.usage.inputTokens,
        outputTokens: usage.outputTokens + outcome.usage.outputTokens,
      };
    }
    if (outcome.kind === 'failed') return failed(outcome.code, outcome.detail);

    contents.push(outcome.content);
    if (outcome.calls.length === 0) return { kind: 'done', text: outcome.text, contents, usage, calls };

    const responses: IGeminiPart[] = [];
    for (const call of outcome.calls) {
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

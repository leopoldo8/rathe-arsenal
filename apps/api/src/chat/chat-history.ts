import { IGeminiContent } from './gemini-chat-client';

export const HISTORY_TOKEN_BUDGET = 30_000;

export interface IHistoryMessage {
  readonly role: 'user' | 'assistant';
  readonly status: string;
  readonly text: string | null;
  readonly modelContent: readonly IGeminiContent[] | null;
}

export function estimateTokens(contents: readonly IGeminiContent[]): number {
  return Math.ceil(JSON.stringify(contents).length / 4);
}

function asPlainText(exchange: readonly IGeminiContent[]): IGeminiContent[] {
  const merged: IGeminiContent[] = [];
  for (const content of exchange) {
    const parts = content.parts.filter((part) => part.thought !== true && typeof part.text === 'string').map((part) => ({ text: part.text as string }));
    if (parts.length === 0) continue;
    const last = merged[merged.length - 1];
    if (last?.role === content.role) merged[merged.length - 1] = { role: last.role, parts: [...last.parts, ...parts] };
    else merged.push({ role: content.role, parts });
  }
  return merged;
}

/**
 * The conversation as `contents`, oldest first, ending with the current user message (the last `user` message).
 * An exchange is one or more user messages and the assistant turns after them; only the exchange right before the
 * current one keeps its tool rounds. Whole exchanges are dropped from the oldest until the estimate fits,
 * so a function call never loses its response.
 */
export function buildHistory(messages: readonly IHistoryMessage[], tokenBudget: number = HISTORY_TOKEN_BUDGET): IGeminiContent[] {
  const exchanges: IGeminiContent[][] = [];
  let current: IGeminiContent[] | null = null;
  for (const message of messages) {
    if (message.role === 'user') {
      const last = current?.[current.length - 1];
      if (current && last?.role === 'user') {
        current[current.length - 1] = { role: 'user', parts: [...last.parts, { text: message.text ?? '' }] };
      } else {
        current = [{ role: 'user', parts: [{ text: message.text ?? '' }] }];
        exchanges.push(current);
      }
      continue;
    }
    if (message.status !== 'done' || !message.modelContent || !current) continue;
    current.push(...message.modelContent);
  }

  let kept = exchanges.map((exchange, index) => (index < exchanges.length - 2 ? asPlainText(exchange) : exchange));
  while (kept.length > 1 && estimateTokens(kept.flat()) > tokenBudget) kept = kept.slice(1);
  return kept.flat();
}

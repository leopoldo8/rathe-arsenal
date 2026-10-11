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

/**
 * The conversation as `contents`, oldest first, ending with the current user message (the last `user` message).
 * An exchange is one or more user messages and the assistant turns after them; whole exchanges are dropped
 * from the oldest until the estimate fits, so a function call never loses its response.
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

  let kept = exchanges;
  while (kept.length > 1 && estimateTokens(kept.flat()) > tokenBudget) kept = kept.slice(1);
  return kept.flat();
}

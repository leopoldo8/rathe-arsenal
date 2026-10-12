import type { TChatTurnFailureCode } from '../../api/chat';

export type TFailureOutcome = 'limit' | 'timeout' | 'generic';

const TIMEOUT_CODES: ReadonlySet<TChatTurnFailureCode> = new Set([
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'MODEL_TIMEOUT',
  'TURN_TIMEOUT',
  'WORKER_LOST',
]);

export function failureOutcome(code: TChatTurnFailureCode | null): TFailureOutcome {
  if (code === 'BUDGET_EXHAUSTED') return 'limit';
  return code !== null && TIMEOUT_CODES.has(code) ? 'timeout' : 'generic';
}

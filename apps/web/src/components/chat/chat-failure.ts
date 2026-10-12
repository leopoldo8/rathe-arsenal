import type { TChatTurnFailureCode } from '../../api/chat';

export type TFailureOutcome = 'limit' | 'busy' | 'timeout' | 'generic';

// The provider answered quickly with "overloaded" or "too many requests": calling it slow would mislead.
const BUSY_CODES: ReadonlySet<TChatTurnFailureCode> = new Set(['RATE_LIMITED', 'PROVIDER_UNAVAILABLE']);

const TIMEOUT_CODES: ReadonlySet<TChatTurnFailureCode> = new Set(['MODEL_TIMEOUT', 'TURN_TIMEOUT', 'WORKER_LOST']);

export function failureOutcome(code: TChatTurnFailureCode | null): TFailureOutcome {
  if (code === null) return 'generic';
  if (code === 'BUDGET_EXHAUSTED') return 'limit';
  if (BUSY_CODES.has(code)) return 'busy';
  return TIMEOUT_CODES.has(code) ? 'timeout' : 'generic';
}

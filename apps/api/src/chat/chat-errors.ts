import { HttpException, HttpStatus } from '@nestjs/common';

/** Stable codes the client maps to `apiErrors.<code>` copy (AD-003). */
export type TChatErrorCode =
  | 'CHAT_ACCESS_DENIED'
  | 'CHAT_TURN_IN_PROGRESS'
  | 'CHAT_BUDGET_EXHAUSTED'
  | 'MESSAGE_NOT_RETRYABLE'
  | 'PROPOSAL_NOT_PENDING'
  | 'PROPOSAL_STALE';

const ERRORS: Readonly<Record<TChatErrorCode, { readonly status: HttpStatus; readonly message: string }>> = {
  CHAT_ACCESS_DENIED: { status: HttpStatus.FORBIDDEN, message: 'Chat access is not enabled for this account' },
  CHAT_TURN_IN_PROGRESS: { status: HttpStatus.CONFLICT, message: 'An answer is still on its way in this conversation' },
  CHAT_BUDGET_EXHAUSTED: { status: HttpStatus.TOO_MANY_REQUESTS, message: 'The chat budget for this month is used up' },
  MESSAGE_NOT_RETRYABLE: { status: HttpStatus.CONFLICT, message: 'Only a failed answer can be retried' },
  PROPOSAL_NOT_PENDING: { status: HttpStatus.CONFLICT, message: 'This proposal was already decided' },
  PROPOSAL_STALE: { status: HttpStatus.CONFLICT, message: 'This proposal no longer fits the deck' },
};

export function chatError(code: TChatErrorCode, details?: Readonly<Record<string, unknown>>): HttpException {
  const { status, message } = ERRORS[code];
  return new HttpException({ code, message, ...(details ? { details } : {}) }, status);
}

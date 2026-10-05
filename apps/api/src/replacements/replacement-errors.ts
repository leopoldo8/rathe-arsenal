import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable codes the client maps to `apiErrors.<code>` copy (AD-003). Each is a
 * 409: the request was well formed but the deck no longer allows it.
 */
export type TReplacementErrorCode = 'NOTHING_TO_REPLACE' | 'REPLACEMENT_ILLEGAL' | 'REPLACEMENT_NOT_ACTIVE';

const MESSAGES: Readonly<Record<TReplacementErrorCode, string>> = {
  NOTHING_TO_REPLACE: 'This card has no missing copies left to replace',
  REPLACEMENT_ILLEGAL: 'This card cannot take that place in the deck',
  REPLACEMENT_NOT_ACTIVE: 'This replacement was already resolved',
};

export function replacementConflict(code: TReplacementErrorCode): HttpException {
  return new HttpException({ code, message: MESSAGES[code] }, HttpStatus.CONFLICT);
}

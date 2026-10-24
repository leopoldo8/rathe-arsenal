export enum EAuthErrorCode {
  InvalidCredentials = 'INVALID_CREDENTIALS',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  InvalidToken = 'INVALID_TOKEN',
  TokenExpired = 'TOKEN_EXPIRED',
  EmailDeliveryFailed = 'EMAIL_DELIVERY_FAILED',
  UserNotFound = 'USER_NOT_FOUND',
  /** Sign-up with an address that already has an account: the start step says so before this is reachable. */
  EmailTaken = 'EMAIL_TAKEN',
  /** A sign-in code or button token that does not match a live code. */
  InvalidCode = 'INVALID_CODE',
}

export class AuthError extends Error {
  constructor(
    public readonly code: EAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

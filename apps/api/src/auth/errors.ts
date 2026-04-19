export enum EAuthErrorCode {
  // NOTE: EmailInUse removed in Unit 1 / A4 fix. The sign-up endpoint no
  // longer rejects duplicate emails — it returns a generic 202 regardless of
  // whether the email exists, to prevent account enumeration.
  InvalidCredentials = 'INVALID_CREDENTIALS',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  InvalidToken = 'INVALID_TOKEN',
  TokenExpired = 'TOKEN_EXPIRED',
  EmailDeliveryFailed = 'EMAIL_DELIVERY_FAILED',
  UserNotFound = 'USER_NOT_FOUND',
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

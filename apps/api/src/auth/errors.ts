export enum EAuthErrorCode {
  EmailInUse = 'EMAIL_IN_USE',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  InvalidToken = 'INVALID_TOKEN',
  TokenExpired = 'TOKEN_EXPIRED',
  EmailDeliveryFailed = 'EMAIL_DELIVERY_FAILED',
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

export enum EAuthErrorCode {
  InvalidCredentials = 'INVALID_CREDENTIALS',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  /** Creating a share link before the account's e-mail is confirmed. */
  EmailNotConfirmed = 'EMAIL_NOT_CONFIRMED',
  /** Changing the address of an account whose address is already confirmed. */
  EmailAlreadyConfirmed = 'EMAIL_ALREADY_CONFIRMED',
  InvalidToken = 'INVALID_TOKEN',
  TokenExpired = 'TOKEN_EXPIRED',
  EmailDeliveryFailed = 'EMAIL_DELIVERY_FAILED',
  UserNotFound = 'USER_NOT_FOUND',
  /** Sign-up with an address that already has an account: the start step says so before this is reachable. */
  EmailTaken = 'EMAIL_TAKEN',
  /** Sign-up or a code request whose Turnstile token Cloudflare refused. */
  CaptchaFailed = 'CAPTCHA_FAILED',
  /** A sign-in code or button token that does not match a live code. */
  InvalidCode = 'INVALID_CODE',
  /** Five codes were already asked for this address within the hour. */
  TooManyCodes = 'TOO_MANY_CODES',
}

export class AuthError extends Error {
  constructor(
    public readonly code: EAuthErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

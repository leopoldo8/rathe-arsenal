export const apiErrors = {
  // Auth error codes (EAuthErrorCode) — client maps envelope.code → message
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before signing in.',
  INVALID_TOKEN: 'This link is invalid or has expired.',
  TOKEN_EXPIRED: 'This link is invalid or has expired.',
  EMAIL_DELIVERY_FAILED: 'Could not send the email. Please try again later.',
  USER_NOT_FOUND: 'User not found.',
  generic: 'Something went wrong. Please try again.',
  // Rate limit (HTTP 429) — count-based plural
  rateLimitGeneric: 'Too many attempts. Please wait a moment and try again.',
  rateLimitSeconds_one: 'Too many attempts. Please wait {{count}} second and try again.',
  rateLimitSeconds_other: 'Too many attempts. Please wait {{count}} seconds and try again.',
  rateLimitMinutes_one: 'Too many attempts. Please wait {{count}} minute and try again.',
  rateLimitMinutes_other: 'Too many attempts. Please wait {{count}} minutes and try again.',
} as const;

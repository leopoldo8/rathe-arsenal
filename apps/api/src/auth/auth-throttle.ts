const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Per-IP windows of the auth routes; the controller declares each route's window from here. */
export const AUTH_THROTTLE = {
  start: { limit: 30, ttl: MINUTE_MS },
  signUp: { limit: 20, ttl: HOUR_MS },
  signIn: { limit: 5, ttl: MINUTE_MS },
  codes: { limit: 20, ttl: HOUR_MS },
  codesVerify: { limit: 10, ttl: MINUTE_MS },
  codesRedeem: { limit: 10, ttl: MINUTE_MS },
  verifyEmail: { limit: 10, ttl: HOUR_MS },
  resendVerification: { limit: 3, ttl: HOUR_MS },
  deleteAccount: { limit: 5, ttl: HOUR_MS },
} as const;

import type { TFunction } from 'i18next';
import { AuthFetchError } from '../lib/auth-fetch';

/**
 * Localize the API throttler's Retry-After (seconds) into a user-facing wait
 * message. Mirrors the rounding of the previous `formatRateLimitMessage`
 * (seconds under a minute, otherwise minutes) but resolves through i18next so
 * the copy follows the active locale and its plural rules.
 */
export function localizeRateLimit(retryAfterSeconds: number | null, t: TFunction): string {
  if (retryAfterSeconds === null || retryAfterSeconds <= 0) {
    return t('apiErrors.rateLimitGeneric');
  }
  if (retryAfterSeconds < 60) {
    return t('apiErrors.rateLimitSeconds', { count: retryAfterSeconds });
  }
  return t('apiErrors.rateLimitMinutes', { count: Math.ceil(retryAfterSeconds / 60) });
}

/**
 * Localize any auth error for display:
 *  - HTTP 429 → localized wait message (above)
 *  - stable error `code` (EAuthErrorCode on the envelope) → its `apiErrors` entry
 *  - anything else → generic
 *
 * The server's English `message` is deliberately never surfaced in a localized
 * UI; an unmapped code falls back to the generic localized message.
 */
export function localizeAuthError(err: unknown, t: TFunction): string {
  if (err instanceof AuthFetchError) {
    if (err.status === 429) return localizeRateLimit(err.retryAfterSeconds, t);
    if (err.code) return t(`apiErrors.${err.code}`, { defaultValue: t('apiErrors.generic') });
  }
  return t('apiErrors.generic');
}

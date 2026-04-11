/**
 * Formats a user-facing "too many attempts" message from the Retry-After
 * seconds returned by the API throttler (A5). The server sends seconds;
 * we round up to the nearest minute for display when it's at least a minute,
 * otherwise we show seconds. When the header is missing we show a generic
 * wait-and-try-again message without a specific duration.
 */
export function formatRateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null || retryAfterSeconds <= 0) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (retryAfterSeconds < 60) {
    const unit = retryAfterSeconds === 1 ? 'second' : 'seconds';
    return `Too many attempts. Please wait ${retryAfterSeconds} ${unit} and try again.`;
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `Too many attempts. Please wait ${minutes} ${unit} and try again.`;
}

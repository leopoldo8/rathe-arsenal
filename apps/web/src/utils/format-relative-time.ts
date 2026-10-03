import type { TFunction } from 'i18next';

/**
 * Converts an ISO 8601 timestamp (or null/undefined) to a natural-language
 * relative time string for use in freshness badges.
 *
 * Bucket thresholds (D9 / R32):
 *  < 1 min  -> "just now"
 *  < 60 min -> "N min ago"
 *  < 24h    -> "Nh ago"
 *  < 7 days -> "N days ago"
 *  >= 7 days -> "over a week ago"
 *  null/undefined -> "no recent data"
 */
export function formatRelativeTime(iso: string | null | undefined, t?: TFunction): string {
  const noData = t ? t('common.relativeNoData') : 'no recent data';
  if (iso == null) {
    return noData;
  }

  const parsed = new Date(iso);

  if (isNaN(parsed.getTime())) {
    return noData;
  }

  const justNow = t ? t('common.relativeJustNow') : 'just now';

  const diffMs = Date.now() - parsed.getTime();

  if (diffMs < 0) {
    // Future timestamp treated as just now
    return justNow;
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return justNow;
  }

  if (diffMin < 60) {
    return t ? t('common.relativeMinutes', { count: diffMin }) : `${diffMin} min ago`;
  }

  if (diffHour < 24) {
    return t ? t('common.relativeHours', { count: diffHour }) : `${diffHour}h ago`;
  }

  if (diffDay < 7) {
    return t ? t('common.relativeDays', { count: diffDay }) : `${diffDay} days ago`;
  }

  return t ? t('common.relativeOverWeek') : 'over a week ago';
}

/**
 * Returns true when the timestamp is older than 24 hours.
 * Used to decide whether to show the amber stale badge.
 */
export function isStale(iso: string | null | undefined): boolean {
  if (iso == null) return false;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return false;
  const diffMs = Date.now() - parsed.getTime();
  return diffMs > 24 * 60 * 60 * 1000;
}

/**
 * Returns true when the timestamp is older than 7 days.
 * Used to decide whether to show the red very-stale badge.
 */
export function isVeryStale(iso: string | null | undefined): boolean {
  if (iso == null) return false;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) return false;
  const diffMs = Date.now() - parsed.getTime();
  return diffMs > 7 * 24 * 60 * 60 * 1000;
}

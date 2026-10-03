import type { TFunction } from 'i18next';

/**
 * Formats an ISO 8601 timestamp (or null) as a localized freshness label
 * for the Library stats bar estimated-value caption.
 *
 * Rules (R32):
 *  - N <= 3 days: "N day(s) ago" - shown in muted color
 *  - N > 3 days:  "N day(s) ago" - shown in ember color
 *  - null:        "No price data" - shown in muted color
 *
 * @returns An object with `label` text and `stale` boolean (true when N > 3).
 */
export function formatDaysAgo(
  iso: string | null,
  t: TFunction,
): { label: string; stale: boolean } {
  const noData = { label: t('library.priceFreshnessNone'), stale: false };
  if (iso === null) {
    return noData;
  }

  const parsed = new Date(iso);
  if (isNaN(parsed.getTime())) {
    return noData;
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const days = Math.max(0, diffDays);
  return { label: t('library.priceFreshnessDays', { count: days }), stale: days > 3 };
}

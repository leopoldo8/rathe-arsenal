const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const UNITS: ReadonlyArray<{ readonly unit: Intl.RelativeTimeFormatUnit; readonly ms: number }> = [
  { unit: 'year', ms: YEAR_MS },
  { unit: 'month', ms: MONTH_MS },
  { unit: 'day', ms: DAY_MS },
  { unit: 'hour', ms: HOUR_MS },
  { unit: 'minute', ms: MINUTE_MS },
];

export function formatElapsed(
  value: Date | string,
  locale: string,
  now: number = Date.now(),
): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = new Date(value).getTime() - now;
  const absMs = Math.abs(diffMs);

  const match = UNITS.find(({ ms }) => absMs >= ms);
  if (!match) return rtf.format(0, 'second');
  return rtf.format(Math.trunc(diffMs / match.ms), match.unit);
}

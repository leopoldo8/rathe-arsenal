function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A group is read only when it was never read, or tcgcsv rebuilt since the last read, and never twice in one UTC day.
 */
export function shouldReadGroup(lastFetchedAt: Date | null, tcgcsvLastUpdated: Date, now: Date): boolean {
  if (lastFetchedAt === null) return true;
  if (utcDay(lastFetchedAt) === utcDay(now)) return false;
  return lastFetchedAt.getTime() < tcgcsvLastUpdated.getTime();
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return utcDay(a) === utcDay(b);
}

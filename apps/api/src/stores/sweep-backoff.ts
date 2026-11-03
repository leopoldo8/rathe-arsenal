const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Waits after the 1st, 2nd, 3rd and 4th consecutive failed sweep; past that, the next scheduled sweep. */
export const SWEEP_RETRY_DELAYS_MS: readonly number[] = [1, 4, 12, 24].map((hours) => hours * HOUR_MS);

/** Wait after a 402 whose message names no credit reset time. */
export const OUT_OF_CREDITS_FALLBACK_WAIT_MS = DAY_MS;

const OUT_OF_CREDITS = /\bHTTP 402\b/;
const CREDIT_RESET_AT = /resetting at (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/;

export interface ISweepFailure {
  /** Consecutive failed sweeps, this one included; 402s do not add to it. */
  readonly failures: number;
  readonly failedAt: Date;
  readonly error: string | null;
}

/** Firecrawl answers 402 when the plan's credits are spent; retrying before they reset cannot succeed. */
export function isOutOfCredits(error: string | null): boolean {
  return error !== null && OUT_OF_CREDITS.test(error);
}

function creditResetAfter(error: string, failedAt: Date): Date | null {
  const match = CREDIT_RESET_AT.exec(error);
  if (match === null) return null;
  const resetAt = new Date(match[1]!);
  return Number.isNaN(resetAt.getTime()) || resetAt.getTime() <= failedAt.getTime() ? null : resetAt;
}

/** When the automatic sweep may run again after a failure. */
export function nextSweepAttemptAt(failure: ISweepFailure, passDays: number): Date {
  const { failedAt, error } = failure;
  if (error !== null && isOutOfCredits(error)) {
    return creditResetAfter(error, failedAt) ?? new Date(failedAt.getTime() + OUT_OF_CREDITS_FALLBACK_WAIT_MS);
  }
  // A count of 0 is a failure recorded before the count existed: treat it as the first.
  const index = Math.max(failure.failures, 1) - 1;
  const delay = SWEEP_RETRY_DELAYS_MS[index] ?? passDays * DAY_MS;
  return new Date(failedAt.getTime() + delay);
}

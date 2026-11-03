import { isOutOfCredits, nextSweepAttemptAt, SWEEP_RETRY_DELAYS_MS } from '../sweep-backoff';

const FAILED_AT = new Date('2026-11-01T05:00:00Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PASS_DAYS = 14;
const OUT_OF_CREDITS =
  'Fetch failed for https://www.cupuladt.com.br/?view=ecom/edicoesTCG&tcg=8: Firecrawl returned HTTP 402: ' +
  'Insufficient credits to perform this request: it can use up to 1 credits and your team has 0 left, ' +
  'with plan credits resetting at 2026-11-10T01:46:07.375Z. For more credits, you can upgrade your plan.';

function after(failures: number, error = 'did not return a listing page'): Date {
  return nextSweepAttemptAt({ failures, failedAt: FAILED_AT, error }, PASS_DAYS);
}

describe('sweep backoff', () => {
  it('waits 1h, 4h, 12h and 24h after the first four consecutive failures', () => {
    // Arrange
    const expectedWaits = [1, 4, 12, 24].map((hours) => hours * HOUR_MS);

    // Act
    const waits = [1, 2, 3, 4].map((failures) => after(failures).getTime() - FAILED_AT.getTime());

    // Assert
    expect(SWEEP_RETRY_DELAYS_MS).toEqual(expectedWaits);
    expect(waits).toEqual(expectedWaits);
  });

  it('stops retrying until the next scheduled sweep once the schedule is spent', () => {
    // Act
    const fifth = after(5);
    const tenth = after(10);

    // Assert
    expect(fifth).toEqual(new Date(FAILED_AT.getTime() + PASS_DAYS * DAY_MS));
    expect(tenth).toEqual(new Date(FAILED_AT.getTime() + PASS_DAYS * DAY_MS));
  });

  it('treats a count of zero (a failure recorded before the count existed) as the first failure', () => {
    expect(after(0)).toEqual(new Date(FAILED_AT.getTime() + HOUR_MS));
  });

  it('waits for the Firecrawl credit reset when the provider answered 402', () => {
    // Act
    const next = after(1, OUT_OF_CREDITS);

    // Assert
    expect(isOutOfCredits(OUT_OF_CREDITS)).toBe(true);
    expect(next).toEqual(new Date('2026-11-10T01:46:07.375Z'));
  });

  it('waits a day after a 402 that names no reset time, or a reset already in the past', () => {
    // Arrange
    const noReset = 'Firecrawl returned HTTP 402: Payment required';
    const pastReset = 'Firecrawl returned HTTP 402: credits resetting at 2026-10-10T01:46:07.375Z';

    // Act + Assert
    expect(after(1, noReset)).toEqual(new Date(FAILED_AT.getTime() + DAY_MS));
    expect(after(1, pastReset)).toEqual(new Date(FAILED_AT.getTime() + DAY_MS));
  });

  it('does not mistake other errors for running out of credits', () => {
    expect(isOutOfCredits('Firecrawl returned HTTP 429')).toBe(false);
    expect(isOutOfCredits(null)).toBe(false);
  });
});

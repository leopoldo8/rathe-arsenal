import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, isStale, isVeryStale } from '../format-relative-time';

/**
 * Tests for the freshness helper used by the shopping line section.
 * Pins `Date.now` to a fixed epoch for deterministic bucket assertions.
 */
describe('formatRelativeTime', () => {
  const NOW_ISO = '2026-04-12T12:00:00.000Z';
  const NOW_MS = new Date(NOW_ISO).getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "no recent data" for null', () => {
    expect(formatRelativeTime(null)).toBe('no recent data');
  });

  it('returns "no recent data" for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('no recent data');
  });

  it('returns "no recent data" for an invalid date string', () => {
    expect(formatRelativeTime('not-a-date')).toBe('no recent data');
  });

  it('returns "just now" for a timestamp 30 seconds ago', () => {
    const iso = new Date(NOW_MS - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('just now');
  });

  it('returns "just now" for a future timestamp', () => {
    const iso = new Date(NOW_MS + 5000).toISOString();
    expect(formatRelativeTime(iso)).toBe('just now');
  });

  it('returns "N min ago" for a timestamp 30 minutes ago', () => {
    const iso = new Date(NOW_MS - 30 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('30 min ago');
  });

  it('returns "1 min ago" at exactly 1 minute', () => {
    const iso = new Date(NOW_MS - 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('1 min ago');
  });

  it('returns "Nh ago" for a timestamp 2 hours ago', () => {
    const iso = new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('2h ago');
  });

  it('returns "Nh ago" for a timestamp 23 hours ago', () => {
    const iso = new Date(NOW_MS - 23 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('23h ago');
  });

  it('returns "N days ago" for a timestamp 3 days ago', () => {
    const iso = new Date(NOW_MS - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('3 days ago');
  });

  it('returns "N days ago" for a timestamp 6 days ago', () => {
    const iso = new Date(NOW_MS - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('6 days ago');
  });

  it('returns "over a week ago" for a timestamp 8 days ago', () => {
    const iso = new Date(NOW_MS - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('over a week ago');
  });

  it('returns "over a week ago" for a timestamp 30 days ago', () => {
    const iso = new Date(NOW_MS - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe('over a week ago');
  });
});

describe('isStale', () => {
  const NOW_MS = new Date('2026-04-12T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for null', () => {
    expect(isStale(null)).toBe(false);
  });

  it('returns false for a fresh timestamp (1 hour ago)', () => {
    const iso = new Date(NOW_MS - 60 * 60 * 1000).toISOString();
    expect(isStale(iso)).toBe(false);
  });

  it('returns true for a timestamp 25 hours ago', () => {
    const iso = new Date(NOW_MS - 25 * 60 * 60 * 1000).toISOString();
    expect(isStale(iso)).toBe(true);
  });
});

describe('isVeryStale', () => {
  const NOW_MS = new Date('2026-04-12T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for null', () => {
    expect(isVeryStale(null)).toBe(false);
  });

  it('returns false for a stale-but-not-very-stale timestamp (3 days ago)', () => {
    const iso = new Date(NOW_MS - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isVeryStale(iso)).toBe(false);
  });

  it('returns true for a timestamp 8 days ago', () => {
    const iso = new Date(NOW_MS - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isVeryStale(iso)).toBe(true);
  });
});

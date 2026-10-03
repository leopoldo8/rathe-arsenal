import { describe, it, expect } from 'vitest';
import i18n from '../index';
import { formatElapsed } from '../format-elapsed';
import { setTestLocale } from '../../test/i18n-test-utils';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('formatElapsed', () => {
  it('says "3 days ago" in pt-BR for a date three days back', () => {
    expect(formatElapsed(new Date(NOW - 3 * DAY_MS), 'pt-BR', NOW)).toBe('há 3 dias');
  });

  it('says "3 days ago" in en-US for the same date', () => {
    expect(formatElapsed(new Date(NOW - 3 * DAY_MS), 'en-US', NOW)).toBe('3 days ago');
  });

  it('uses hours below one day and minutes below one hour', () => {
    expect(formatElapsed(new Date(NOW - 5 * 60 * 60 * 1000), 'en-US', NOW)).toBe('5 hours ago');
    expect(formatElapsed(new Date(NOW - 7 * 60 * 1000), 'en-US', NOW)).toBe('7 minutes ago');
  });

  it('collapses less than a minute into "now"', () => {
    expect(formatElapsed(new Date(NOW - 10 * 1000), 'en-US', NOW)).toBe('now');
  });

  it('accepts an ISO string and switches to months past 30 days', () => {
    expect(formatElapsed(new Date(NOW - 65 * DAY_MS).toISOString(), 'en-US', NOW)).toBe('2 months ago');
  });
});

describe('relativeTime i18next formatter', () => {
  it('follows the active language when used through t()', async () => {
    i18n.addResource('pt-BR', 'translation', 'test.elapsed', '{{date, relativeTime}}');
    const date = new Date(Date.now() - 3 * DAY_MS);
    expect(i18n.t('test.elapsed', { date })).toBe('há 3 dias');

    await setTestLocale('en-US');
    i18n.addResource('en-US', 'translation', 'test.elapsed', '{{date, relativeTime}}');
    expect(i18n.t('test.elapsed', { date })).toBe('3 days ago');
  });
});

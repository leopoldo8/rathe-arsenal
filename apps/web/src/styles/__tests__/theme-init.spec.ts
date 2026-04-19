import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../theme-init';

describe('resolveTheme', () => {
  // Happy path
  it('returns "dark" when localStorage value is "dark"', () => {
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('returns "light" when localStorage value is "light"', () => {
    expect(resolveTheme('light')).toBe('light');
  });

  // Edge cases
  it('returns "dark" when localStorage value is null (key absent)', () => {
    expect(resolveTheme(null)).toBe('dark');
  });

  it('returns "dark" when localStorage value is undefined', () => {
    expect(resolveTheme(undefined)).toBe('dark');
  });

  it('returns "dark" when localStorage value is an unknown string', () => {
    expect(resolveTheme('bogus')).toBe('dark');
  });

  it('returns "dark" when localStorage value is an empty string', () => {
    expect(resolveTheme('')).toBe('dark');
  });

  it('returns "dark" when localStorage value is a script-injection attempt', () => {
    expect(resolveTheme('<script>alert(1)</script>')).toBe('dark');
  });

  it('returns "dark" when localStorage value is "Dark" (case-sensitive)', () => {
    expect(resolveTheme('Dark')).toBe('dark');
  });
});

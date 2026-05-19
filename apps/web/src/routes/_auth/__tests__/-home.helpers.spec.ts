import { describe, it, expect } from 'vitest';
import { validateHomeSearch, DEFAULT_HOME_SEARCH } from '../-home.helpers';

describe('validateHomeSearch', () => {
  it('returns empty tag array for empty input', () => {
    const result = validateHomeSearch({});
    expect(result.tag).toEqual([]);
  });

  it('accepts a valid array of string tags', () => {
    const result = validateHomeSearch({ tag: ['foo', 'bar'] });
    expect(result.tag).toEqual(['foo', 'bar']);
  });

  it('filters out non-string elements from tag array', () => {
    const result = validateHomeSearch({ tag: ['foo', 123, null, 'bar', true] });
    expect(result.tag).toEqual(['foo', 'bar']);
  });

  it('falls back to [] when tag is a single string (not an array)', () => {
    // TanStack Router's default serializer uses JSON arrays; a single raw
    // string param value (?tag=foo instead of ?tag=%5B%22foo%22%5D) does
    // not match the expected array shape and should be ignored.
    const result = validateHomeSearch({ tag: 'foo' });
    expect(result.tag).toEqual([]);
  });

  it('falls back to [] when tag is a number', () => {
    const result = validateHomeSearch({ tag: 42 });
    expect(result.tag).toEqual([]);
  });

  it('falls back to [] when tag is null', () => {
    const result = validateHomeSearch({ tag: null });
    expect(result.tag).toEqual([]);
  });

  it('falls back to [] when tag is undefined (key absent)', () => {
    const result = validateHomeSearch({});
    expect(result.tag).toEqual([]);
  });

  it('falls back to [] when tag is an object', () => {
    const result = validateHomeSearch({ tag: { name: 'foo' } });
    expect(result.tag).toEqual([]);
  });

  it('accepts an empty array for tag', () => {
    const result = validateHomeSearch({ tag: [] });
    expect(result.tag).toEqual([]);
  });

  it('ignores additional unknown params (does not throw)', () => {
    const result = validateHomeSearch({ tag: ['foo'], unknownKey: 'ignored' });
    expect(result.tag).toEqual(['foo']);
  });

  it('returns the correct THomeSearch shape', () => {
    const result = validateHomeSearch({ tag: ['league', 'casual'] });
    expect(Object.keys(result)).toEqual(['tag']);
  });

  describe('DEFAULT_HOME_SEARCH', () => {
    it('has empty tag array', () => {
      expect(DEFAULT_HOME_SEARCH.tag).toEqual([]);
    });
  });

  describe('unknown tag validation (caller responsibility)', () => {
    it('returns the tag array as-is including unknown tag names', () => {
      // validateHomeSearch does NOT filter by user-owned tags — that is
      // done by the caller (home.tsx) after cross-referencing availableTags.
      const result = validateHomeSearch({ tag: ['league', 'completely-unknown-tag'] });
      expect(result.tag).toEqual(['league', 'completely-unknown-tag']);
    });
  });
});

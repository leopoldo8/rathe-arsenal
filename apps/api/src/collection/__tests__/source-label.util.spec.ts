/**
 * Unit tests for the source label de-duplication helpers.
 */

import {
  parseSourceLabel,
  nextDedupedLabel,
} from '../sources/source-label.util';

describe('parseSourceLabel', () => {
  it('treats a plain label as occurrence 1', () => {
    expect(parseSourceLabel('My Deck')).toEqual({ index: 1, base: 'My Deck' });
  });

  it('extracts the counter and base from a generated prefix', () => {
    expect(parseSourceLabel('#3 My Deck')).toEqual({ index: 3, base: 'My Deck' });
  });

  it('keeps a "#1 " prefix as part of the base (never generated)', () => {
    expect(parseSourceLabel('#1 My Deck')).toEqual({
      index: 1,
      base: '#1 My Deck',
    });
  });

  it('preserves a base that itself contains a colon (Fabrary labels)', () => {
    expect(parseSourceLabel('#2 Fabrary: Kayo Brute Bash')).toEqual({
      index: 2,
      base: 'Fabrary: Kayo Brute Bash',
    });
  });

  it('does not strip a lone "#" with no number', () => {
    expect(parseSourceLabel('#tag deck')).toEqual({
      index: 1,
      base: '#tag deck',
    });
  });
});

describe('nextDedupedLabel', () => {
  it('returns the plain base when there is no collision', () => {
    expect(nextDedupedLabel('collection.csv', [])).toBe('collection.csv');
    expect(nextDedupedLabel('collection.csv', ['other.csv'])).toBe(
      'collection.csv',
    );
  });

  it('assigns "#2" for the first duplicate of a plain label', () => {
    expect(nextDedupedLabel('collection.csv', ['collection.csv'])).toBe(
      '#2 collection.csv',
    );
  });

  it('assigns "#3" when the base and "#2" already exist', () => {
    expect(
      nextDedupedLabel('collection.csv', ['collection.csv', '#2 collection.csv']),
    ).toBe('#3 collection.csv');
  });

  it('derives the next index from the highest occurrence, surviving gaps', () => {
    // The plain "collection.csv" was deleted; only "#2" remains. The next
    // one must be "#3" so it cannot collide with the surviving "#2".
    expect(nextDedupedLabel('collection.csv', ['#2 collection.csv'])).toBe(
      '#3 collection.csv',
    );
  });

  it('treats Fabrary labels as a family keyed on the deck name', () => {
    expect(
      nextDedupedLabel('Fabrary: Kayo Brute Bash', ['Fabrary: Kayo Brute Bash']),
    ).toBe('#2 Fabrary: Kayo Brute Bash');
  });

  it('does not mix different base labels into the same family', () => {
    expect(
      nextDedupedLabel('collection.csv', [
        'other.csv',
        '#2 other.csv',
        'collection.csv',
      ]),
    ).toBe('#2 collection.csv');
  });
});

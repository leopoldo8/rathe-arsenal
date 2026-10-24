import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from '../next-path';

describe('sanitizeNextPath', () => {
  it('keeps a page inside the app, with its query string', () => {
    expect(sanitizeNextPath('/decks/12')).toBe('/decks/12');
    expect(sanitizeNextPath('/decks/12?edit=1')).toBe('/decks/12?edit=1');
    expect(sanitizeNextPath('/lists/3')).toBe('/lists/3');
  });

  it('drops anything that could leave the app or loop back to the start page', () => {
    for (const unsafe of [
      'https://evil.example/x',
      '//evil.example',
      '/\\evil.example',
      'decks/12',
      '/decks/1 2',
      '/',
      '/entrar',
      '/entrar?next=%2Fdecks%2F1',
      '/entrar/x',
      '',
    ]) {
      expect(sanitizeNextPath(unsafe)).toBeNull();
    }
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath(42)).toBeNull();
  });
});

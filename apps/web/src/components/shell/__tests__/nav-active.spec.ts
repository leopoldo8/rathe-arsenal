import { describe, it, expect } from 'vitest';
import { resolveActiveNavKey } from '../nav-active';

describe('resolveActiveNavKey — Home', () => {
  it('activates Home on /home', () => {
    expect(resolveActiveNavKey('/home')).toBe('home');
  });

  it('activates Home on a /home/ sub-route', () => {
    expect(resolveActiveNavKey('/home/something')).toBe('home');
  });

  it('activates Home on deck detail (/decks/$deckId) — the fixed bug', () => {
    expect(resolveActiveNavKey('/decks/abc-123')).toBe('home');
  });

  it('activates Home on deck detail with the ?edit=1 search param present', () => {
    // The search param never enters pathname matching — /decks/$deckId
    // covers edit mode too, since it is the same route.
    expect(resolveActiveNavKey('/decks/abc-123')).toBe('home');
  });

  it('activates Home on /decks/new — the fixed bug', () => {
    expect(resolveActiveNavKey('/decks/new')).toBe('home');
  });
});

describe('resolveActiveNavKey — Library', () => {
  it('activates Library on /library', () => {
    expect(resolveActiveNavKey('/library')).toBe('library');
  });

  it('activates Library on /library-csv-sources — the fixed bug', () => {
    expect(resolveActiveNavKey('/library-csv-sources')).toBe('library');
  });

  it('activates Library on /add-cards — the fixed bug', () => {
    expect(resolveActiveNavKey('/add-cards')).toBe('library');
  });

  it('activates Library on /add-cards/manual', () => {
    expect(resolveActiveNavKey('/add-cards/manual')).toBe('library');
  });

  it('activates Library on /add-cards/fabrary', () => {
    expect(resolveActiveNavKey('/add-cards/fabrary')).toBe('library');
  });

  it('activates Library on /add-cards/csv', () => {
    expect(resolveActiveNavKey('/add-cards/csv')).toBe('library');
  });

  it('does NOT activate Library on an unrelated route that merely starts with "/library" as a string prefix followed by another word', () => {
    // Guards against the old accidental-prefix-match bug in the other
    // direction: a hypothetical /library-settings should not silently
    // count as Library just because it shares the "/library" prefix.
    expect(resolveActiveNavKey('/library-settings')).toBe(null);
  });
});

describe('resolveActiveNavKey — Swaps', () => {
  it('activates Swaps on /swaps', () => {
    expect(resolveActiveNavKey('/swaps')).toBe('swaps');
  });

  it('activates Swaps on a /swaps/ sub-route', () => {
    expect(resolveActiveNavKey('/swaps/123')).toBe('swaps');
  });
});

describe('resolveActiveNavKey — no match', () => {
  it('resolves to null for /settings', () => {
    expect(resolveActiveNavKey('/settings')).toBe(null);
  });

  it('resolves to null for /about', () => {
    expect(resolveActiveNavKey('/about')).toBe(null);
  });

  it('resolves to null for /onboarding', () => {
    expect(resolveActiveNavKey('/onboarding')).toBe(null);
  });

  it('resolves to null for the root path', () => {
    expect(resolveActiveNavKey('/')).toBe(null);
  });
});

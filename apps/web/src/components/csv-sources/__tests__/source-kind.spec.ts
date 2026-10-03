import { describe, it, expect } from 'vitest';
import { deriveSourceKind } from '../source-kind';
import type { ICsvSource } from '../../../api/csv-sources';

function build(overrides: Partial<ICsvSource>): ICsvSource {
  return {
    id: 's',
    userId: 'u',
    kind: 'csv',
    label: null,
    originalFilename: null,
    sourceUrl: null,
    contentHash: null,
    cardCount: 0,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveSourceKind', () => {
  it('returns csv for a csv source without a URL', () => {
    expect(deriveSourceKind(build({ kind: 'csv', sourceUrl: null }))).toBe('csv');
  });

  it('returns fabrary for a csv source that carries a source URL', () => {
    expect(deriveSourceKind(build({ kind: 'csv', sourceUrl: 'https://fabrary.net/decks/A' }))).toBe('fabrary');
  });

  it('returns manual for the manual kind regardless of URL', () => {
    expect(deriveSourceKind(build({ kind: 'manual' }))).toBe('manual');
    expect(deriveSourceKind(build({ kind: 'manual', sourceUrl: 'https://x' }))).toBe('manual');
  });
});

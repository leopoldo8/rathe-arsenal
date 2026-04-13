import { computePath } from '../src/readiness/compute-path';
import { IReadinessBreakdown } from '../src/readiness/types';

function makeBreakdown(
  overrides: Partial<IReadinessBreakdown> = {},
): IReadinessBreakdown {
  const missing = Object.freeze(overrides.missing ?? []);
  const substituted = Object.freeze(overrides.substituted ?? []);
  return Object.freeze({
    exact: Object.freeze(overrides.exact ?? []),
    substituted,
    missing,
    notOwned: Object.freeze(overrides.notOwned ?? [
      ...missing,
      ...substituted.map((e) => e.original),
    ]),
  });
}

describe('computePath', () => {
  it('returns Path A when nothing is missing and nothing is substituted', () => {
    const breakdown = makeBreakdown({
      exact: Object.freeze([
        Object.freeze({ cardIdentifier: 'a', quantity: 3, slot: 'mainboard' }),
      ]),
    });

    expect(computePath(breakdown)).toBe('A');
  });

  it('returns Path A when every breakdown list is empty', () => {
    // Degenerate case -- empty deck still counts as a 100% assembled nothing.
    expect(computePath(makeBreakdown())).toBe('A');
  });

  it('returns Path B when every missing card is covered by a substitution', () => {
    const originalEntry = Object.freeze({
      cardIdentifier: 'a',
      quantity: 1,
      slot: 'mainboard',
    });
    const breakdown = makeBreakdown({
      substituted: Object.freeze([
        Object.freeze({
          original: originalEntry,
          match: Object.freeze({
            substitute: Object.freeze({
              cardIdentifier: 'b',
              name: 'B',
              classes: Object.freeze([]),
              talents: Object.freeze([]),
              types: Object.freeze([]),
              pitch: 1,
              power: 1,
              defense: 1,
              cost: 1,
              keywords: Object.freeze([]),
              subtypes: Object.freeze([]),
              legalHeroes: Object.freeze([]),
            }),
            tier: 1 as const,
            score: 1,
            rationale: 'test',
          }),
        }),
      ]),
    });

    expect(computePath(breakdown)).toBe('B');
  });

  it('returns Path C when any cards remain missing, even if substitutions were also found', () => {
    const breakdown = makeBreakdown({
      substituted: Object.freeze([
        Object.freeze({
          original: Object.freeze({
            cardIdentifier: 'a',
            quantity: 1,
            slot: 'mainboard',
          }),
          match: Object.freeze({
            substitute: Object.freeze({
              cardIdentifier: 'b',
              name: 'B',
              classes: Object.freeze([]),
              talents: Object.freeze([]),
              types: Object.freeze([]),
              pitch: 1,
              power: 1,
              defense: 1,
              cost: 1,
              keywords: Object.freeze([]),
              subtypes: Object.freeze([]),
              legalHeroes: Object.freeze([]),
            }),
            tier: 2 as const,
            score: 0.75,
            rationale: 'test',
          }),
        }),
      ]),
      missing: Object.freeze([
        Object.freeze({ cardIdentifier: 'c', quantity: 2, slot: 'mainboard' }),
      ]),
    });

    expect(computePath(breakdown)).toBe('C');
  });

  it('returns Path C when cards are missing and none are substituted', () => {
    const breakdown = makeBreakdown({
      missing: Object.freeze([
        Object.freeze({ cardIdentifier: 'c', quantity: 3, slot: 'mainboard' }),
      ]),
    });

    expect(computePath(breakdown)).toBe('C');
  });

  it('is a pure function — callable against a legacy snapshot breakdown shape', () => {
    // Simulates reading a persisted snapshot's breakdown JSONB that predates
    // the `path` field. The helper must derive the path from breakdown alone
    // without any additional state.
    const legacyBreakdown: IReadinessBreakdown = Object.freeze({
      exact: Object.freeze([
        Object.freeze({ cardIdentifier: 'x', quantity: 4, slot: 'mainboard' }),
      ]),
      substituted: Object.freeze([]),
      missing: Object.freeze([]),
      notOwned: Object.freeze([]),
    });

    expect(computePath(legacyBreakdown)).toBe('A');
  });
});

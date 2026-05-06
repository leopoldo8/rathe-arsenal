import { computePath } from '../src/readiness/compute-path';
import { IBreakdownEntry, IReadinessBreakdown } from '../src/readiness/types';

/** U11: IBreakdownEntry now requires pitch, cost, type. Helper adds defaults. */
function makeEntry(
  cardIdentifier: string,
  quantity: number,
  slot: string = 'mainboard',
): IBreakdownEntry {
  return Object.freeze({
    cardIdentifier,
    name: cardIdentifier,
    quantity,
    slot,
    pitch: null as 1 | 2 | 3 | null,
    cost: null as number | null,
    type: 'ally',
    imageUrl: null,
  });
}

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
        makeEntry('a', 3),
      ]),
    });

    expect(computePath(breakdown)).toBe('A');
  });

  it('returns Path A when every breakdown list is empty', () => {
    // Degenerate case -- empty deck still counts as a 100% assembled nothing.
    expect(computePath(makeBreakdown())).toBe('A');
  });

  it('returns Path B when every missing card is covered by a substitution', () => {
    const originalEntry = makeEntry('a', 1);
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
              sets: Object.freeze([]),
              imageUrl: null,
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
          original: makeEntry('a', 1),
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
              sets: Object.freeze([]),
              imageUrl: null,
            }),
            tier: 2 as const,
            score: 0.75,
            rationale: 'test',
          }),
        }),
      ]),
      missing: Object.freeze([
        makeEntry('c', 2),
      ]),
    });

    expect(computePath(breakdown)).toBe('C');
  });

  it('returns Path C when cards are missing and none are substituted', () => {
    const breakdown = makeBreakdown({
      missing: Object.freeze([
        makeEntry('c', 3),
      ]),
    });

    expect(computePath(breakdown)).toBe('C');
  });

  it('is a pure function — callable against a legacy snapshot breakdown shape', () => {
    // Simulates reading a persisted snapshot's breakdown JSONB that predates
    // the `path` field. The helper must derive the path from breakdown alone
    // without any additional state.
    const legacyBreakdown: IReadinessBreakdown = Object.freeze({
      exact: Object.freeze([makeEntry('x', 4)]),
      substituted: Object.freeze([]),
      missing: Object.freeze([]),
      notOwned: Object.freeze([]),
    });

    expect(computePath(legacyBreakdown)).toBe('A');
  });
});

import { computeFidelity } from '../src/readiness/compute-fidelity';
import {
  IBreakdownEntry,
  IReadinessBreakdown,
  ISubstitutedEntry,
} from '../src/readiness/types';
import { ISubstitutionMatch } from '../src/substitution/types';

function makeEntry(
  cardIdentifier: string,
  quantity: number,
  slot: string = 'mainboard',
): IBreakdownEntry {
  // U11: IBreakdownEntry now requires pitch, cost, type.
  // Tests use null/null/'ally' as contextually appropriate defaults.
  return Object.freeze({ cardIdentifier, quantity, slot, pitch: null, cost: null, type: 'ally' });
}

function makeMatch(
  substituteId: string,
  tier: 1 | 2,
): ISubstitutionMatch {
  return Object.freeze({
    substitute: Object.freeze({
      cardIdentifier: substituteId,
      name: substituteId,
      classes: Object.freeze([]),
      talents: Object.freeze([]),
      types: Object.freeze([]),
      pitch: 1,
      power: 3,
      defense: 3,
      cost: 1,
      keywords: Object.freeze([]),
      subtypes: Object.freeze([]),
      legalHeroes: Object.freeze([]),
    }) as unknown as ISubstitutionMatch['substitute'],
    score: 100,
    tier,
    rationale: `Tier ${tier} match`,
  });
}

function makeSubstituted(
  originalId: string,
  quantity: number,
  substituteId: string,
  tier: 1 | 2,
): ISubstitutedEntry {
  return Object.freeze({
    original: makeEntry(originalId, quantity),
    match: makeMatch(substituteId, tier),
  });
}

function makeBreakdown(overrides: Partial<IReadinessBreakdown> = {}): IReadinessBreakdown {
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

describe('computeFidelity', () => {
  it('returns 0 when totalCards is 0 (empty deck)', () => {
    const breakdown = makeBreakdown();

    const result = computeFidelity(breakdown, 0);

    expect(result).toBe(0);
  });

  it('returns 0 when inventory is empty (all cards missing)', () => {
    const breakdown = makeBreakdown({
      missing: [makeEntry('card-a', 60)],
    });

    const result = computeFidelity(breakdown, 60);

    expect(result).toBe(0);
  });

  it('returns 100 when every card is exact', () => {
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 60)],
    });

    const result = computeFidelity(breakdown, 60);

    expect(result).toBe(100);
  });

  it('computes 75.666... for 40 exact + 6 tier 1 substitutes + 14 missing out of 60', () => {
    // (40 * 1.0 + 6 * 0.9) / 60 * 100 = (40 + 5.4) / 60 * 100 = 45.4 / 60 * 100 = 75.6666...
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 40)],
      substituted: [
        makeSubstituted('card-b', 6, 'card-b-alt', 1),
      ],
      missing: [makeEntry('card-c', 14)],
    });

    const result = computeFidelity(breakdown, 60);

    expect(result).toBeCloseTo(75.6666, 3);
  });

  it('computes 74.666... for 40 exact + 3 tier1 + 3 tier2 + 14 missing out of 60', () => {
    // (40 * 1.0 + 3 * 0.9 + 3 * 0.7) / 60 * 100 = (40 + 2.7 + 2.1) / 60 * 100 = 44.8 / 60 * 100 = 74.666...
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 40)],
      substituted: [
        makeSubstituted('card-b', 3, 'card-b-alt', 1),
        makeSubstituted('card-c', 3, 'card-c-alt', 2),
      ],
      missing: [makeEntry('card-d', 14)],
    });

    const result = computeFidelity(breakdown, 60);

    expect(result).toBeCloseTo(74.6666, 3);
  });

  it('applies tier 1 weight of 0.9 exactly', () => {
    // 1 tier 1 substitute out of 1 total card = 0.9 / 1 * 100 = 90
    const breakdown = makeBreakdown({
      substituted: [makeSubstituted('card-a', 1, 'card-a-alt', 1)],
    });

    const result = computeFidelity(breakdown, 1);

    expect(result).toBe(90);
  });

  it('applies tier 2 weight of 0.7 exactly', () => {
    // 1 tier 2 substitute out of 1 total card = 0.7 / 1 * 100 = 70
    const breakdown = makeBreakdown({
      substituted: [makeSubstituted('card-a', 1, 'card-a-alt', 2)],
    });

    const result = computeFidelity(breakdown, 1);

    expect(result).toBe(70);
  });

  it('sums multiple exact entries correctly', () => {
    // 20 + 20 = 40 exact out of 60 = 66.666...
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 20), makeEntry('card-b', 20)],
      missing: [makeEntry('card-c', 20)],
    });

    const result = computeFidelity(breakdown, 60);

    expect(result).toBeCloseTo(66.6666, 3);
  });

  it('sums multiple substituted entries at the same tier', () => {
    // (0 + 2 * 0.9 + 3 * 0.9) / 10 * 100 = (0 + 4.5) / 10 * 100 = 45
    const breakdown = makeBreakdown({
      substituted: [
        makeSubstituted('card-a', 2, 'card-a-alt', 1),
        makeSubstituted('card-b', 3, 'card-b-alt', 1),
      ],
      missing: [makeEntry('card-c', 5)],
    });

    const result = computeFidelity(breakdown, 10);

    expect(result).toBe(45);
  });

  it('is a pure function: same input yields same output', () => {
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 40)],
      substituted: [makeSubstituted('card-b', 6, 'card-b-alt', 1)],
      missing: [makeEntry('card-c', 14)],
    });

    const r1 = computeFidelity(breakdown, 60);
    const r2 = computeFidelity(breakdown, 60);

    expect(r1).toBe(r2);
  });

  it('returns a JavaScript number (not NaN, not Infinity) on edge cases', () => {
    const empty = makeBreakdown();

    const zero = computeFidelity(empty, 0);

    expect(Number.isFinite(zero)).toBe(true);
    expect(Number.isNaN(zero)).toBe(false);
  });

  it('ignores missing entries when computing fidelity (they contribute 0)', () => {
    // 10 exact + 50 missing out of 60 = 10/60 * 100 = 16.666...
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 10)],
      missing: [makeEntry('card-b', 50)],
    });

    const result = computeFidelity(breakdown, 60);

    expect(result).toBeCloseTo(16.6666, 3);
  });

  it('does not pre-round: returns full floating-point precision', () => {
    // 1 exact out of 3 = 33.333...
    const breakdown = makeBreakdown({
      exact: [makeEntry('card-a', 1)],
      missing: [makeEntry('card-b', 2)],
    });

    const result = computeFidelity(breakdown, 3);

    // If the helper pre-rounded to 1 decimal, we'd see 33.3 exactly.
    // The contract is full precision — let the frontend format.
    expect(result).not.toBe(33.3);
    expect(result).toBeCloseTo(33.333333, 5);
  });
});

import {
  computePitchCurve,
  computePitchDelta,
  isWithinTolerance,
} from '../src/substitution/pitch-curve';
import { IPitchCurve, IPitchDelta, IPitchTolerance } from '../src/substitution/types';

describe('computePitchCurve', () => {
  it('counts red, yellow, blue, and colorless correctly', () => {
    const cards = [
      { pitch: 1, quantity: 3 },   // red
      { pitch: 2, quantity: 2 },   // yellow
      { pitch: 3, quantity: 5 },   // blue
      { pitch: null, quantity: 1 }, // colorless
    ];

    const curve = computePitchCurve(cards);

    expect(curve.red).toBe(3);
    expect(curve.yellow).toBe(2);
    expect(curve.blue).toBe(5);
    expect(curve.colorless).toBe(1);
  });

  it('returns all zeros for an empty array', () => {
    const curve = computePitchCurve([]);

    expect(curve.red).toBe(0);
    expect(curve.yellow).toBe(0);
    expect(curve.blue).toBe(0);
    expect(curve.colorless).toBe(0);
  });

  it('treats all null pitches as colorless', () => {
    const cards = [
      { pitch: null, quantity: 4 },
      { pitch: null, quantity: 2 },
    ];

    const curve = computePitchCurve(cards);

    expect(curve.red).toBe(0);
    expect(curve.yellow).toBe(0);
    expect(curve.blue).toBe(0);
    expect(curve.colorless).toBe(6);
  });

  it('handles quantity > 1 correctly', () => {
    const cards = [{ pitch: 1, quantity: 10 }];

    const curve = computePitchCurve(cards);

    expect(curve.red).toBe(10);
  });

  it('returns a frozen object', () => {
    const curve = computePitchCurve([{ pitch: 1, quantity: 1 }]);

    expect(Object.isFrozen(curve)).toBe(true);
  });
});

describe('computePitchDelta', () => {
  it('computes absolute difference per color, ignoring colorless', () => {
    const original: IPitchCurve = { red: 10, yellow: 5, blue: 8, colorless: 3 };
    const modified: IPitchCurve = { red: 8, yellow: 6, blue: 8, colorless: 10 };

    const delta = computePitchDelta(original, modified);

    expect(delta.red).toBe(2);
    expect(delta.yellow).toBe(1);
    expect(delta.blue).toBe(0);
  });

  it('returns zeros when curves are identical', () => {
    const curve: IPitchCurve = { red: 5, yellow: 3, blue: 7, colorless: 2 };

    const delta = computePitchDelta(curve, curve);

    expect(delta.red).toBe(0);
    expect(delta.yellow).toBe(0);
    expect(delta.blue).toBe(0);
  });

  it('returns a frozen object', () => {
    const curve: IPitchCurve = { red: 1, yellow: 1, blue: 1, colorless: 0 };
    const delta = computePitchDelta(curve, curve);

    expect(Object.isFrozen(delta)).toBe(true);
  });
});

describe('isWithinTolerance', () => {
  const tolerance: IPitchTolerance = { red: 2, yellow: 1, blue: 1 };

  it('returns true when delta is within tolerance', () => {
    const delta: IPitchDelta = { red: 1, yellow: 0, blue: 1 };

    expect(isWithinTolerance(delta, tolerance)).toBe(true);
  });

  it('returns true when delta exactly equals tolerance', () => {
    const delta: IPitchDelta = { red: 2, yellow: 1, blue: 1 };

    expect(isWithinTolerance(delta, tolerance)).toBe(true);
  });

  it('returns false when red exceeds tolerance', () => {
    const delta: IPitchDelta = { red: 3, yellow: 0, blue: 0 };

    expect(isWithinTolerance(delta, tolerance)).toBe(false);
  });

  it('returns false when yellow exceeds tolerance', () => {
    const delta: IPitchDelta = { red: 0, yellow: 2, blue: 0 };

    expect(isWithinTolerance(delta, tolerance)).toBe(false);
  });

  it('returns false when blue exceeds tolerance', () => {
    const delta: IPitchDelta = { red: 0, yellow: 0, blue: 2 };

    expect(isWithinTolerance(delta, tolerance)).toBe(false);
  });

  it('returns true when all zeros', () => {
    const delta: IPitchDelta = { red: 0, yellow: 0, blue: 0 };

    expect(isWithinTolerance(delta, tolerance)).toBe(true);
  });
});

import { IPitchCurve, IPitchDelta, IPitchTolerance } from './types';

interface IPitchEntry {
  readonly pitch: number | null;
  readonly quantity: number;
}

/**
 * Compute the pitch distribution for a set of cards.
 * pitch 1 = red, 2 = yellow, 3 = blue, null = colorless.
 */
export function computePitchCurve(cards: readonly IPitchEntry[]): IPitchCurve {
  let red = 0;
  let yellow = 0;
  let blue = 0;
  let colorless = 0;

  for (const card of cards) {
    switch (card.pitch) {
      case 1:
        red += card.quantity;
        break;
      case 2:
        yellow += card.quantity;
        break;
      case 3:
        blue += card.quantity;
        break;
      default:
        colorless += card.quantity;
        break;
    }
  }

  return Object.freeze({ red, yellow, blue, colorless });
}

/**
 * Compute the absolute difference per color between two pitch curves.
 * Ignores colorless.
 */
export function computePitchDelta(
  original: IPitchCurve,
  modified: IPitchCurve,
): IPitchDelta {
  return Object.freeze({
    red: Math.abs(original.red - modified.red),
    yellow: Math.abs(original.yellow - modified.yellow),
    blue: Math.abs(original.blue - modified.blue),
  });
}

/**
 * Check whether a pitch delta is within the given tolerance.
 */
export function isWithinTolerance(
  delta: IPitchDelta,
  tolerance: IPitchTolerance,
): boolean {
  return (
    delta.red <= tolerance.red &&
    delta.yellow <= tolerance.yellow &&
    delta.blue <= tolerance.blue
  );
}

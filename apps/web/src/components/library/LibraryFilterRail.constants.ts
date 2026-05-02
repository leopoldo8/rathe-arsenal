/**
 * Card-size constants and the snap helper for LibraryFilterRail.
 *
 * Extracted so that `LibraryFilterRail.tsx` can re-export them as constant
 * exports (allowed by the `react-refresh/only-export-components` rule with
 * `allowConstantExport: true`), while the `snapCardSize` function export
 * that triggers the rule warning is kept here and imported where needed.
 *
 * Consumers:
 *  - `LibraryFilterRail.tsx` (imports + re-exports as constants; imports snapCardSize for internal use)
 *  - `routes/_auth/-library.helpers.ts` (imports snapCardSize for validateLibrarySearch)
 */

export const CARD_SIZE_STEPS: readonly number[] = Object.freeze([
  80, 120, 160, 200, 240,
]);
export const CARD_SIZE_MIN = CARD_SIZE_STEPS[0]!;
export const CARD_SIZE_MAX = CARD_SIZE_STEPS[CARD_SIZE_STEPS.length - 1]!;
export const CARD_SIZE_DEFAULT = 120;
export const CARD_SIZE_LABELS: Readonly<Record<number, string>> = Object.freeze({
  80: 'Small',
  120: 'Medium',
  160: 'Large',
  200: 'X-Large',
  240: 'Max',
});

export function snapCardSize(value: number): number {
  if (!Number.isFinite(value)) return CARD_SIZE_DEFAULT;
  let best = CARD_SIZE_STEPS[0]!;
  let bestDistance = Math.abs(value - best);
  for (const step of CARD_SIZE_STEPS) {
    const distance = Math.abs(value - step);
    if (distance < bestDistance) {
      best = step;
      bestDistance = distance;
    }
  }
  return best;
}

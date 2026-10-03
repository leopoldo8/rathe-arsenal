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
export const CARD_SIZE_LABEL_KEYS: Readonly<Record<number, string>> = Object.freeze({
  80: 'library.cardSizeSmall',
  120: 'library.cardSizeMedium',
  160: 'library.cardSizeLarge',
  200: 'library.cardSizeXLarge',
  240: 'library.cardSizeMax',
});

export const CARD_SIZE_STORAGE_KEY = 'ra-library-card-size';

export function readStoredCardSize(): number | null {
  try {
    const raw = window.localStorage.getItem(CARD_SIZE_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? snapCardSize(parsed) : null;
  } catch {
    return null;
  }
}

export function writeStoredCardSize(size: number): void {
  try {
    window.localStorage.setItem(CARD_SIZE_STORAGE_KEY, String(size));
  } catch {
    // Storage can be blocked (private mode); the URL param still carries the size.
  }
}

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

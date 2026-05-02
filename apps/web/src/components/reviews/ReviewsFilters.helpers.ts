/**
 * Types and constants for the ReviewsFilters component.
 *
 * Extracted into a sibling file so that `ReviewsFilters.tsx` remains a
 * component-only module and Fast Refresh works without warnings.
 */

export interface IReviewsFilters {
  readonly tier: ReadonlyArray<1 | 2 | 3>;
  readonly deck: readonly string[];
  readonly hero: readonly string[];
  readonly confidenceMin: number;
  readonly confidenceMax: number;
}

export const DEFAULT_FILTERS: IReviewsFilters = {
  tier: [],
  deck: [],
  hero: [],
  confidenceMin: 0,
  confidenceMax: 100,
};

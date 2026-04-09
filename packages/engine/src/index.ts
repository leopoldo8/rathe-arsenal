/**
 * @rathe-arsenal/engine -- pure TypeScript substitution engine.
 * Zero framework imports. Catalog (Unit 3) and substitution scoring
 * (Unit 6) land in subsequent units.
 */

export const ENGINE_VERSION = '0.0.0';

// Catalog
export { catalog } from './catalog/catalog';
export { buildIndices } from './catalog/indices';
export { CardNotFoundError } from './catalog/errors';
export type {
  ICatalog,
  ICatalogCard,
  ICatalogIndices,
} from './catalog/types';
export { Class, Hero, Keyword, Talent, Type } from './catalog/types';

// Substitution
export type {
  ISubstitutionMatch,
  IPitchCurve,
  IPitchDelta,
  IPitchTolerance,
} from './substitution';
export {
  TIER_1_FLOOR_SCORE,
  DEFAULT_PITCH_TOLERANCE,
  KEYWORD_OVERLAP_WEIGHT,
  POWER_DELTA_WEIGHT,
  DEFENSE_DELTA_WEIGHT,
  BASE_SCORE,
  computePitchCurve,
  computePitchDelta,
  isWithinTolerance,
  composeRationale,
  tier1Substitution,
} from './substitution';

// Readiness
export type {
  IBreakdownEntry,
  ISubstitutedEntry,
  IReadinessBreakdown,
  IEffectiveReadinessResult,
} from './readiness';
export { computeEffectiveReadiness } from './readiness';

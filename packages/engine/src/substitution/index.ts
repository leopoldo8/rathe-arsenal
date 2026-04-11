export type {
  ISubstitutionMatch,
  IPitchCurve,
  IPitchDelta,
  IPitchTolerance,
  ITierConfig,
  TSubstitutionTier,
} from './types';

export {
  TIER_1_FLOOR_SCORE,
  TIER_2_FLOOR_SCORE,
  TIER_1_CONFIG,
  TIER_2_CONFIG,
  DEFAULT_PITCH_TOLERANCE,
  KEYWORD_OVERLAP_WEIGHT,
  POWER_DELTA_WEIGHT,
  DEFENSE_DELTA_WEIGHT,
  BASE_SCORE,
} from './constants';

export {
  computePitchCurve,
  computePitchDelta,
  isWithinTolerance,
} from './pitch-curve';

export { composeRationale } from './rationale';
export { scoreCandidate, findTierMatch } from './score';
export { findSubstitution } from './find-substitution';

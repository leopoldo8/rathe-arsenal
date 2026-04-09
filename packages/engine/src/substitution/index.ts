export type {
  ISubstitutionMatch,
  IPitchCurve,
  IPitchDelta,
  IPitchTolerance,
} from './types';

export {
  TIER_1_FLOOR_SCORE,
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
export { tier1Substitution } from './tier1';

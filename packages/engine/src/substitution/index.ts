export type {
  ISubstitutionMatch,
  IPitchCurve,
  IPitchDelta,
  IPitchTolerance,
  ITierConfig,
  TSubstitutionTier,
} from './types';

export type { TExclusionKey } from './exclusion-key';
export { buildExclusionKey } from './exclusion-key';

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

export { composeRationale, describeRationale } from './rationale';
export type { IRationaleDetail, TRationalePitch } from './rationale';
export { scoreCandidate, findTierMatch } from './score';
export { findSubstitution } from './find-substitution';
export {
  ALTERNATIVE_GROUP_ORDER,
  ALTERNATIVES_PER_GROUP,
  OWNED_SCORE_BONUS,
  compareAlternatives,
  findAlternatives,
} from './alternatives';
export type {
  IAlternativeCard,
  IAlternativeGroup,
  IAlternativeRationale,
  IAlternativesInput,
  TAlternativeGroup,
  TRelaxedRule,
} from './alternatives';

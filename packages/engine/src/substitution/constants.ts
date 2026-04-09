import { IPitchTolerance } from './types';

export const TIER_1_FLOOR_SCORE = 0.90;

export const DEFAULT_PITCH_TOLERANCE: IPitchTolerance = Object.freeze({
  red: 2,
  yellow: 1,
  blue: 1,
});

export const KEYWORD_OVERLAP_WEIGHT = 0.35;
export const POWER_DELTA_WEIGHT = 0.15;
export const DEFENSE_DELTA_WEIGHT = 0.15;
export const BASE_SCORE = 1.0;

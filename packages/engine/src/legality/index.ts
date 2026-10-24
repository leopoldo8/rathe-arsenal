/**
 * Legality engine barrel.
 * Re-exports all public types and functions for the legality module.
 */

export type {
  TSupportedFormat,
  TLegalityCategory,
  IFormatRules,
  IDeckLegalityResult,
  ILegalityCard,
  ILegalityCatalog,
  ILegalityDeck,
  ILegalityDeckCard,
  TLegalityReasonDetail,
} from './types';

export { FORMAT_RULES } from './rules';
export { computeDeckLegality, isSizeProblem } from './compute';
export type { ICardLegalityViolation } from './card-legality';
export { findCardLegalityViolation, getCopyLimit } from './card-legality';

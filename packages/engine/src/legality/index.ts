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

export type { IRuleChange } from './rules';
export { FORMAT_RULES, RULE_CHANGES } from './rules';
export { computeDeckLegality, computeDeckLegalityInOtherFormats, isSizeProblem } from './compute';
export type { IFormatVerdict } from './compute';
export type { ICardLegalityViolation } from './card-legality';
export { findCardLegalityViolation, getCopyLimit } from './card-legality';

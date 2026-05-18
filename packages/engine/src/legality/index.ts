/**
 * Legality engine barrel.
 * Re-exports all public types and functions for the legality module.
 */

export type {
  TSupportedFormat,
  TLegalityCategory,
  IFormatRules,
  IDeckLegalityResult,
  ILegalityDeck,
  ILegalityDeckCard,
} from './types';

export { FORMAT_RULES } from './rules';
export { computeDeckLegality } from './compute';

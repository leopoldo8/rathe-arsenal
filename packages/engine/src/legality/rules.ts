/**
 * Format rules constants for the four supported FaB constructed formats.
 *
 * Source: LSS Tournament Rules and Policy
 * https://rules.fabtcg.com/en/trp/07-constructed-formats/
 *
 * These are structural constants updated manually when LSS publishes a
 * structural rule change (≤1×/year cadence). Per-card legality (bans,
 * restrictions, hero pools) is read from `@flesh-and-blood/cards` at
 * runtime — not hardcoded here.
 */

import { Rarity } from '../catalog/types';
import type { IFormatRules, TSupportedFormat } from './types';

/**
 * Frozen record of format rules keyed by `TSupportedFormat`.
 *
 * All values are Object.freeze'd — the legality engine reads them as
 * immutable constants.
 */
export const FORMAT_RULES: Readonly<Record<TSupportedFormat, IFormatRules>> = Object.freeze({
  'Classic Constructed': Object.freeze<IFormatRules>({
    minMainboard: 60,
    exactMainboard: null,
    maxCardPool: 80,
    maxCopies: 3,
    requiresYoungHero: false,
    allowedRarities: null,
    source: 'https://fabtcg.com/gameplay-formats/classic-constructed/',
  }),
  Blitz: Object.freeze<IFormatRules>({
    minMainboard: 40,
    exactMainboard: 40,
    maxCardPool: 52,
    maxCopies: 2,
    requiresYoungHero: true,
    allowedRarities: null,
    source: 'https://fabtcg.com/articles/official-blitz-update/',
  }),
  'Living Legend': Object.freeze<IFormatRules>({
    minMainboard: 60,
    exactMainboard: null,
    maxCardPool: 80,
    maxCopies: 3,
    requiresYoungHero: false,
    allowedRarities: null,
    source: 'https://fabtcg.com/living-legend/',
  }),
  'Silver Age': Object.freeze<IFormatRules>({
    minMainboard: 40,
    exactMainboard: 40,
    maxCardPool: 52,
    maxCopies: 2,
    requiresYoungHero: true,
    allowedRarities: Object.freeze(
      new Set<string>([Rarity.Common, Rarity.Rare, Rarity.Basic, Rarity.Token]),
    ),
    source: 'https://fabtcg.com/gameplay-formats/silver-age/',
  }),
} satisfies Record<TSupportedFormat, IFormatRules>);

import { IReadinessBreakdown } from './types';

/**
 * Path classification derived purely from the breakdown shape:
 *
 *  - **A**: every card in the deck is owned exactly (100% exact coverage).
 *  - **B**: missing cards are all covered by substitutions
 *           (effective coverage = 100%, but not all exact).
 *  - **C**: some cards remain missing even after substitution attempts.
 *
 * The function is a single source of truth for the path field. Unit 6
 * (test mode), Unit 7 (re-solve), and Unit 8 (Path C display) all consume
 * this helper rather than duplicating the logic.
 *
 * Legacy snapshots persisted before the `path` field existed can be
 * classified at read time by invoking this function against the stored
 * `breakdown` JSONB. No database migration is required.
 */
export function computePath(breakdown: IReadinessBreakdown): 'A' | 'B' | 'C' {
  if (breakdown.missing.length > 0) return 'C';
  if (breakdown.substituted.length > 0) return 'B';
  return 'A';
}

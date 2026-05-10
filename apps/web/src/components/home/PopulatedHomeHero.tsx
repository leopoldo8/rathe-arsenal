import React from 'react';
import { ITrackedDeckListItem } from '../../api/decks';
import styles from './PopulatedHomeHero.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IPopulatedHomeHeroProps {
  readonly decks: readonly ITrackedDeckListItem[];
  /**
   * Total physical card copies the user does not own across all tracked
   * decks. Sourced from `ITrackedDeckListResponse.totalCardsMissing` —
   * sum of `breakdown.notOwned[].quantity` per snapshot. Counts duplicates
   * (3x copies needed and missing → 3, not 1).
   *
   * Decoupled from the shopping line: always rendered when non-null, even
   * when no priced store is configured. Null only when no snapshot exists.
   */
  readonly totalCardsMissing: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAverageReadiness(decks: readonly ITrackedDeckListItem[]): number | null {
  const withSnapshot = decks.filter((d) => d.latestSnapshot !== null);
  if (withSnapshot.length === 0) return null;
  const sum = withSnapshot.reduce(
    (acc, d) => acc + (d.latestSnapshot?.effectivePercent ?? 0),
    0,
  );
  return Math.round(sum / withSnapshot.length);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PopulatedHomeHero — 3-stat differentiated header for the home page.
 *
 * Stat 1: Tracked deck count — secondary treatment (plain number + label).
 * Stat 2: Average readiness % — secondary treatment (plain number + label).
 * Stat 3: Cards missing — PRIMARY brass treatment.
 *
 * Typographic distinction:
 *  - `.ra-readiness-display` (Cinzel Decorative 900 brass) is RESERVED for
 *    deck card effectivePercent % values (origin R7). Do NOT use it here.
 *  - `.ra-hero-primary-stat` (Cinzel 700 brass, large) is used for the
 *    hero "cards missing" count. Same accent palette, different weight/font,
 *    because count vs. percentage have different semantic meanings.
 */
export function PopulatedHomeHero({
  decks,
  totalCardsMissing,
}: IPopulatedHomeHeroProps): React.ReactElement {
  const avgReadiness = computeAverageReadiness(decks);

  const readyCount = decks.filter(
    (d) => (d.latestSnapshot?.effectivePercent ?? 0) >= 80,
  ).length;
  const almostCount = decks.filter((d) => {
    const pct = d.latestSnapshot?.effectivePercent ?? 0;
    return pct >= 50 && pct < 80;
  }).length;
  const needsCount = decks.filter(
    (d) => (d.latestSnapshot?.effectivePercent ?? 0) < 50,
  ).length;

  return (
    <header className={styles.hero}>
      <div className={styles.heroLeft}>
        <div className={styles.eyebrow}>Your armory</div>
        <h1 className={styles.headline}>Your Decks</h1>
        <p className={styles.summary}>
          {readyCount > 0 && (
            <span className={styles.summaryReady}>
              {readyCount} ready to play
            </span>
          )}
          {almostCount > 0 && (
            <span className={styles.summaryAlmost}>
              {readyCount > 0 ? ' · ' : ''}{almostCount} almost there
            </span>
          )}
          {needsCount > 0 && (
            <span className={styles.summaryNeeds}>
              {(readyCount > 0 || almostCount > 0) ? ' · ' : ''}{needsCount} to build
            </span>
          )}
        </p>
      </div>

      <div className={styles.heroStats} aria-label="Collection statistics">
        {/* Stat 1: Tracked decks — secondary */}
        <div className={styles.stat}>
          <div className={styles.statNumber}>{decks.length}</div>
          <div className={styles.statLabel}>Decks</div>
        </div>

        {/* Stat 2: Average readiness — secondary */}
        <div className={styles.stat}>
          <div className={styles.statNumber}>
            {avgReadiness !== null ? `${avgReadiness}%` : '--'}
          </div>
          <div className={styles.statLabel}>Avg ready</div>
        </div>

        {/* Stat 3: Cards missing — PRIMARY brass signature treatment.
            Uses .ra-hero-primary-stat (Cinzel 700, brass, large).
            NOT .ra-readiness-display (that is reserved for % values on R7).
            Counts every needed copy (sum of breakdown.notOwned quantities),
            so 3x missing of the same card contributes 3. */}
        {totalCardsMissing !== null && (
          <div className={`${styles.stat} ${styles.statPrimary}`}>
            <div className={`${styles.statNumber} ${styles.heroPrimaryStat} ra-hero-primary-stat`}>
              {totalCardsMissing}
            </div>
            <div className={styles.statLabel}>Cards missing</div>
          </div>
        )}

        <div className={styles.importAction}>
          <a href="/decks/new" className={styles.trackLink}>
            Track new deck
          </a>
        </div>
      </div>
    </header>
  );
}

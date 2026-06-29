import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ITrackedDeckListItem } from '../../api/decks';
import styles from './PopulatedHomeHero.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IPopulatedHomeHeroProps {
  readonly decks: readonly ITrackedDeckListItem[];
  /**
   * Total physical card copies the user does not own across all tracked
   * non-retired decks. Sourced from `ITrackedDeckListResponse.totalCardsMissing` —
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

/**
 * Computes average readiness over non-retired decks that have snapshots.
 * Retired decks are excluded from the denominator (U9 R12a).
 */
function computeAverageReadiness(decks: readonly ITrackedDeckListItem[]): number | null {
  const nonRetiredWithSnapshot = decks.filter(
    (d) => d.status !== 'retired' && d.latestSnapshot !== null,
  );
  if (nonRetiredWithSnapshot.length === 0) return null;
  const sum = nonRetiredWithSnapshot.reduce(
    (acc, d) => acc + (d.latestSnapshot?.effectivePercent ?? 0),
    0,
  );
  return Math.round(sum / nonRetiredWithSnapshot.length);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PopulatedHomeHero — 3-stat header for the home page.
 *
 * Stat 1: Active library count — non-retired decks only (U9 R12a).
 * Stat 2: Average readiness % — non-retired decks only (U9 R12a).
 * Stat 3: Cards missing — passed as prop (already filtered at the API level,
 *         or re-derived by the caller from non-retired decks).
 *
 * All three stats share the same secondary treatment (display font,
 * h1 size, primary fg) so the row reads as a uniform triplet.
 *
 * `.ra-readiness-display` (Cinzel Decorative 900 brass) is RESERVED for
 * deck card effectivePercent % values (origin R7) — not used here.
 *
 * The CTA is "Add new deck" (renamed from "Track new deck" per R44) and
 * uses TanStack `<Link to="/decks/new">` instead of a bare `<a>`.
 */
export function PopulatedHomeHero({
  decks,
  totalCardsMissing,
}: IPopulatedHomeHeroProps): React.ReactElement {
  const { t } = useTranslation();
  // Non-retired decks — all three stats are scoped to this subset (U9 R12a)
  const activeDecks = decks.filter((d) => d.status !== 'retired');

  const activeLibraryCount = activeDecks.length;
  const avgReadiness = computeAverageReadiness(decks);

  // Summary row: readiness-tier breakdown for non-retired decks
  const readyCount = activeDecks.filter(
    (d) => (d.latestSnapshot?.effectivePercent ?? 0) >= 80,
  ).length;
  const almostCount = activeDecks.filter((d) => {
    const pct = d.latestSnapshot?.effectivePercent ?? 0;
    return pct >= 50 && pct < 80;
  }).length;
  const needsCount = activeDecks.filter(
    (d) => (d.latestSnapshot?.effectivePercent ?? 0) < 50,
  ).length;

  return (
    <header className={styles.hero}>
      <div className={styles.heroLeft}>
        <div className={styles.eyebrow}>{t('home.armoryEyebrow')}</div>
        <h1 className={styles.headline}>{t('home.yourDecksHeading')}</h1>
        <p className={styles.summary}>
          {readyCount > 0 && (
            <span className={styles.summaryReady}>
              {t('home.summaryReady', { count: readyCount })}
            </span>
          )}
          {almostCount > 0 && (
            <span className={styles.summaryAlmost}>
              {readyCount > 0 ? ' · ' : ''}{t('home.summaryAlmost', { count: almostCount })}
            </span>
          )}
          {needsCount > 0 && (
            <span className={styles.summaryNeeds}>
              {(readyCount > 0 || almostCount > 0) ? ' · ' : ''}{t('home.summaryNeeds', { count: needsCount })}
            </span>
          )}
        </p>
      </div>

      <div className={styles.heroStats} aria-label={t('home.collectionStatsLabel')}>
        {/* Stat 1: Active (non-retired) deck count — secondary */}
        <div className={styles.stat}>
          <div className={styles.statNumber}>{activeLibraryCount}</div>
          <div className={styles.statLabel}>{t('home.decksStatLabel')}</div>
        </div>

        {/* Stat 2: Average readiness over non-retired decks — secondary */}
        <div className={styles.stat}>
          <div className={styles.statNumber}>
            {avgReadiness !== null ? `${avgReadiness}%` : '--'}
          </div>
          <div className={styles.statLabel}>{t('home.avgReadyStatLabel')}</div>
        </div>

        {/* Stat 3: Cards missing — same secondary treatment as the other
            two stats (Decks · Avg ready) so the row reads as a uniform
            triplet. Counts every needed copy (sum of breakdown.notOwned
            quantities), so 3x missing of the same card contributes 3. */}
        {totalCardsMissing !== null && (
          <div className={styles.stat}>
            <div className={styles.statNumber}>{totalCardsMissing}</div>
            <div className={styles.statLabel}>{t('home.cardsMissingStatLabel')}</div>
          </div>
        )}

        {/* CTA renamed from "Track new deck" to "Add new deck" per R44.
            Uses TanStack <Link> instead of a bare <a>. */}
        <div className={styles.importAction}>
          <Link to="/decks/new" className={styles.trackLink}>
            {t('home.addNewDeckCta')}
          </Link>
        </div>
      </div>
    </header>
  );
}

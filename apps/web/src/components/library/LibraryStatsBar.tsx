import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBrl } from '../../utils/format-brl';
import { formatDaysAgo } from '../../lib/format-relative-time';
import type { ILibraryStats } from '../../api/library';
import styles from './LibraryStatsBar.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ILibraryStatsBarProps {
  readonly stats: ILibraryStats;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LibraryStatsBar — sticky stats strip below the search bar.
 *
 * Desktop (>= 640 px): single row with uniqueCount, totalCopies, pitch pills,
 * estimated value + freshness, and "Manage CSVs" button right-aligned.
 *
 * Mobile (< 640 px): two rows — row 1 has counts + pills; row 2 has value
 * + "Manage CSVs" button.
 */
export function LibraryStatsBar({ stats }: ILibraryStatsBarProps): React.ReactElement {
  const { t } = useTranslation();
  const { uniqueCount, totalCopies, pitchBreakdown, estimatedValueCents, priceDataLastUpdatedAt } =
    stats;

  const { label: freshnessLabel, stale: isStale } = formatDaysAgo(priceDataLastUpdatedAt);
  const isNullData = priceDataLastUpdatedAt === null;

  return (
    <section className={styles.bar} aria-label={t('library.collectionStatisticsLabel')}>
      {/* Row 1 — counts + pitch pills */}
      <div className={styles.row1}>
        <span className={styles.stat}>
          <span className={styles.statValue}>{uniqueCount}</span>
          <span className={styles.statLabel}>{t('library.uniqueStatLabel')}</span>
        </span>

        <span className={styles.separator} aria-hidden="true" />

        <span className={styles.stat}>
          <span className={styles.statValue}>{totalCopies}</span>
          <span className={styles.statLabel}>{t('library.copiesStatLabel')}</span>
        </span>

        <span className={styles.separator} aria-hidden="true" />

        <div className={styles.pitchPills} aria-label={t('library.pitchBreakdownLabel')}>
          {pitchBreakdown.red > 0 && (
            <span className={`${styles.pill} ${styles.pillRed}`} title={t('library.redPitchTitle')}>
              R {pitchBreakdown.red}
            </span>
          )}
          {pitchBreakdown.yellow > 0 && (
            <span className={`${styles.pill} ${styles.pillYellow}`} title={t('library.yellowPitchTitle')}>
              Y {pitchBreakdown.yellow}
            </span>
          )}
          {pitchBreakdown.blue > 0 && (
            <span className={`${styles.pill} ${styles.pillBlue}`} title={t('library.bluePitchTitle')}>
              B {pitchBreakdown.blue}
            </span>
          )}
          {pitchBreakdown.colorless > 0 && (
            <span
              className={`${styles.pill} ${styles.pillColorless}`}
              title={t('library.colorlessPitchTitle')}
            >
              — {pitchBreakdown.colorless}
            </span>
          )}
        </div>
      </div>

      {/* Row 2 — estimated value + freshness chip.
          The "Manage CSVs" link previously sat here; it's been removed
          now that /add-cards is the canonical entry point for adding
          and /library-csv-sources is reachable from there. The stats
          bar is purely informational again. */}
      <div className={styles.row2}>
        <div className={styles.valueBlock}>
          <span className={styles.valueAmount}>
            {isNullData ? 'R$ 0,00' : formatBrl(estimatedValueCents)}
          </span>
          <span
            className={isStale ? styles.freshnessStale : styles.freshnessMuted}
            title={t('library.estimatedPricesTooltip')}
          >
            {isStale && <span aria-hidden="true">◆ </span>}
            {freshnessLabel}
          </span>
        </div>
      </div>
    </section>
  );
}

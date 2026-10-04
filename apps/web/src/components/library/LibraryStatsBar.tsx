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

const PITCH_ENTRIES = [
  { key: 'red', dotClass: styles.dotRed, titleKey: 'library.redPitchTitle' },
  { key: 'yellow', dotClass: styles.dotYellow, titleKey: 'library.yellowPitchTitle' },
  { key: 'blue', dotClass: styles.dotBlue, titleKey: 'library.bluePitchTitle' },
  { key: 'colorless', dotClass: styles.dotColorless, titleKey: 'library.colorlessPitchTitle' },
] as const;

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

  const { label: freshnessLabel, stale: isStale } = formatDaysAgo(priceDataLastUpdatedAt, t);
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
          {PITCH_ENTRIES.map(({ key, dotClass, titleKey }) =>
            pitchBreakdown[key] > 0 ? (
              <span
                key={key}
                className={styles.pill}
                role="img"
                title={t(titleKey)}
                aria-label={`${t(titleKey)}: ${pitchBreakdown[key]}`}
              >
                <span className={`${styles.dot} ${dotClass}`} aria-hidden="true" />
                {pitchBreakdown[key]}
              </span>
            ) : null,
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
          {!isNullData && <span className={styles.valueAmount}>{formatBrl(estimatedValueCents)}</span>}
          <span
            className={isStale ? styles.freshnessStale : styles.freshnessMuted}
            data-testid="price-freshness"
            title={t('library.estimatedPricesTooltip')}
          >
            {freshnessLabel}
          </span>
        </div>
      </div>
    </section>
  );
}

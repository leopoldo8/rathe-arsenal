import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './DeckDetailSkeleton.module.css';

/**
 * DeckDetailSkeleton — placeholder for the deck detail 3-column layout while
 * the query is in-flight.
 *
 * Mirrors the populated layout (R24):
 *   Column A — readiness hero placeholder
 *   Column B — breakdown list placeholders
 *   Column C — shopping panel placeholder
 *
 * At < 960 px collapses to single-column stack (matches the populated layout
 * breakpoint). Reuses the <Skeleton> primitive which handles shimmer and
 * `prefers-reduced-motion` collapse at the CSS layer.
 */
export function DeckDetailSkeleton(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.layout} role="status" aria-busy="true" aria-label={t('decks.loadingDeckDetails')}>
      {/* Column A — readiness hero placeholder */}
      <div className={styles.colA}>
        <Skeleton height="180px" aria-label={t('decks.loadingReadinessScore')} />
        <div className={styles.heroLine}>
          <Skeleton height="1rem" aria-label={t('decks.loading')} />
        </div>
        <Skeleton height="1rem" width="60%" aria-label={t('decks.loading')} />
      </div>

      {/* Column B — breakdown placeholders */}
      <div className={styles.colB}>
        <div className={styles.sectionTitle}>
          <Skeleton height="1.25rem" width="40%" aria-label={t('decks.loading')} />
        </div>
        <div className={styles.card}>
          <Skeleton height="72px" aria-label={t('decks.loadingCardRow')} />
        </div>
        <div className={styles.card}>
          <Skeleton height="72px" aria-label={t('decks.loadingCardRow')} />
        </div>
        <div className={styles.card}>
          <Skeleton height="72px" aria-label={t('decks.loadingCardRow')} />
        </div>

        <div className={styles.sectionTitle}>
          <Skeleton height="1.25rem" width="40%" aria-label={t('decks.loading')} />
        </div>
        <div className={styles.card}>
          <Skeleton height="72px" aria-label={t('decks.loadingCardRow')} />
        </div>
        <div className={styles.card}>
          <Skeleton height="72px" aria-label={t('decks.loadingCardRow')} />
        </div>
      </div>

      {/* Column C — shopping panel placeholder */}
      <div className={styles.colC}>
        <Skeleton height="220px" aria-label={t('decks.loadingShoppingPanel')} />
      </div>
    </div>
  );
}

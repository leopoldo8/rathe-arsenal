import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './DeckDetailSkeleton.module.css';

/**
 * DeckDetailSkeleton - placeholder for the single-column deck detail view
 * while the query is in-flight: hero banner, analysis cards, then the
 * decklist and shopping panel, inside the same centred 1180px column.
 * Reuses <Skeleton>, which handles shimmer and prefers-reduced-motion.
 */
export function DeckDetailSkeleton(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div
      className={styles.layout}
      role="status"
      aria-busy="true"
      aria-label={t('decks.loadingDeckDetails')}
    >
      <div className={styles.banner} data-testid="deck-detail-skeleton-banner">
        <Skeleton height="210px" aria-label={t('decks.loading')} />
      </div>

      <div className={styles.analysis} data-testid="deck-detail-skeleton-analysis">
        <Skeleton height="180px" aria-label={t('decks.loadingReadinessScore')} />
        <Skeleton height="180px" aria-label={t('decks.loading')} />
        <Skeleton height="180px" aria-label={t('decks.loading')} />
      </div>

      <div className={styles.list} data-testid="deck-detail-skeleton-list">
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
        <Skeleton height="220px" aria-label={t('decks.loadingShoppingPanel')} />
      </div>
    </div>
  );
}

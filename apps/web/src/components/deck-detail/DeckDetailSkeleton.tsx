import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './DeckDetailSkeleton.module.css';

/**
 * DeckDetailSkeleton — placeholder for the deck detail two-column layout
 * while the query is in-flight.
 *
 * Mirrors DeckDetailLayout breakpoints (UXUI-07):
 *   Sidebar — readiness/meta placeholders (280px fixed at ≥1280px)
 *   Canvas  — breakdown list + shopping panel placeholders (1fr)
 *
 * At < 1280px collapses to single-column stack. Reuses <Skeleton> which
 * handles shimmer and prefers-reduced-motion at the CSS layer.
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
      {/* Sidebar — readiness hero placeholder */}
      <div className={styles.sidebar} data-testid="deck-detail-skeleton-sidebar">
        <Skeleton height="180px" aria-label={t('decks.loadingReadinessScore')} />
        <Skeleton height="1rem" aria-label={t('decks.loading')} />
        <Skeleton height="1rem" width="60%" aria-label={t('decks.loading')} />
      </div>

      {/* Canvas — breakdown + shopping panel placeholders */}
      <div className={styles.canvas} data-testid="deck-detail-skeleton-canvas">
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
        <Skeleton height="220px" aria-label={t('decks.loadingShoppingPanel')} />
      </div>
    </div>
  );
}

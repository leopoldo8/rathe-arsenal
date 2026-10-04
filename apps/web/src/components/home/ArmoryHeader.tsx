import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ITrackedDeckListItem, ITrackedDeckListResponse } from '../../api/decks';
import { AggregateCallout } from './AggregateCallout';
import { computeAverageReadiness, countCompleteDecks, isRetired } from './homeGroups';
import styles from './ArmoryHeader.module.css';

interface IArmoryHeaderProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly totalCardsMissing: number | null;
  readonly aggregateShoppingLine?: ITrackedDeckListResponse['aggregateShoppingLine'];
}

/**
 * All three KPIs and the status line are scoped to non-retired decks (R12a),
 * independent of the search and tag filters below.
 */
export function ArmoryHeader({
  decks,
  totalCardsMissing,
  aggregateShoppingLine = null,
}: IArmoryHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const inRotation = decks.filter((deck) => !isRetired(deck));
  const average = computeAverageReadiness(decks);

  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{t('home.armoryHeading')}</h1>
        <p className={styles.status}>
          <span className={styles.statusDot} aria-hidden="true" />
          {t('home.completeDecksStatus', {
            complete: countCompleteDecks(decks),
            count: inRotation.length,
          })}
        </p>
        <AggregateCallout aggregateShoppingLine={aggregateShoppingLine} />
      </div>

      <div className={styles.kpiStrip} role="group" aria-label={t('home.collectionStatsLabel')}>
        <div className={styles.kpiCell}>
          <span className={styles.kpiValue}>{inRotation.length}</span>
          <span className={styles.kpiLabel}>{t('home.decksStatLabel')}</span>
        </div>
        <div className={styles.kpiCell}>
          <span className={`${styles.kpiValue} ${styles.kpiAverage}`}>
            {average !== null ? `${average}%` : '--'}
          </span>
          <span className={styles.kpiLabel}>{t('home.avgReadyStatLabel')}</span>
        </div>
        <div className={styles.kpiCell}>
          <span className={`${styles.kpiValue} ${styles.kpiMissing}`}>
            {totalCardsMissing ?? '--'}
          </span>
          <span className={styles.kpiLabel}>{t('home.cardsMissingStatLabel')}</span>
        </div>
      </div>

      <Link to="/decks/new" className={styles.cta}>
        {t('home.addNewDeckCta')}
      </Link>
    </header>
  );
}

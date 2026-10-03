import React from 'react';
import { useTranslation } from 'react-i18next';
import { ITrackedDeckListResponse } from '../../api/decks';
import { formatBrl } from '../../utils/format-brl';
import styles from './AggregateCallout.module.css';

interface IAggregateCalloutProps {
  readonly aggregateShoppingLine: ITrackedDeckListResponse['aggregateShoppingLine'];
}

/**
 * Second status line of the armory header: "R$ 312 completaria 4 de 6 decks na Cupula DT".
 * Hidden when there is no priced store, nothing to buy, or no deck it would complete.
 */
export function AggregateCallout({
  aggregateShoppingLine,
}: IAggregateCalloutProps): React.ReactElement | null {
  const { t } = useTranslation();
  const agg = aggregateShoppingLine;

  if (!agg) return null;
  if (agg.kind === 'unscraped') return null;
  if (agg.totalCostCents === 0) return null;
  if (agg.completableDecks === 0) return null;

  return (
    <p className={styles.line} data-testid="aggregate-callout">
      <span className={styles.dot} aria-hidden="true" />
      <span>
        <span className={styles.cost}>{formatBrl(agg.totalCostCents)}</span>{' '}
        {t('home.aggregateCompletionVerb')}{' '}
        <strong className={styles.strong}>{agg.completableDecks}</strong>{' '}
        {t('home.aggregateDeckConnector', { total: agg.totalDecks })}{' '}
        <span className={styles.storeName}>{agg.storeName}</span>
      </span>
    </p>
  );
}

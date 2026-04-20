import React from 'react';
import { ITrackedDeckListResponse } from '../../api/decks';
import { formatBrl } from '../../utils/format-brl';
import styles from './AggregateCallout.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IAggregateCalloutProps {
  readonly aggregateShoppingLine: ITrackedDeckListResponse['aggregateShoppingLine'];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AggregateCallout — brass-stroke band below the readiness shelves.
 *
 * Renders: "R$ 312 completaria 4 de 6 decks na Cupula DT"
 *
 * Render guards (D6):
 *  - Hidden when `aggregateShoppingLine` is null.
 *  - Hidden when `kind === 'unscraped'` (store not yet scraped).
 *  - Hidden when `totalCostCents === 0` (nothing to buy).
 *  - Hidden when `completableDecks === 0` (no deck can be completed).
 */
export function AggregateCallout({
  aggregateShoppingLine,
}: IAggregateCalloutProps): React.ReactElement | null {
  const agg = aggregateShoppingLine;

  if (!agg) return null;
  if (agg.kind === 'unscraped') return null;
  if (agg.totalCostCents === 0) return null;
  if (agg.completableDecks === 0) return null;

  return (
    <aside className={styles.callout} aria-label="Aggregate shopping line">
      <span className={styles.cost}>{formatBrl(agg.totalCostCents)}</span>{' '}
      <span className={styles.body}>
        completaria{' '}
        <strong className={styles.strong}>{agg.completableDecks}</strong>{' '}
        de {agg.totalDecks} decks na{' '}
        <span className={styles.storeName}>{agg.storeName}</span>
      </span>
    </aside>
  );
}

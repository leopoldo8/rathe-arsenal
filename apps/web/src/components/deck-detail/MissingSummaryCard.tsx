import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useStoredMissingListQuery } from '../../api/missing-list';
import { formatBrl } from '../../utils/format-brl';
import { missingTotals } from '../missing-list/missingListModel';
import styles from './MissingSummaryCard.module.css';

interface IMissingSummaryCardProps {
  readonly deckId: number;
}

/** The deck page's one card for what is missing: the count in copies, the store's line and the way to the list. */
export function MissingSummaryCard({ deckId }: IMissingSummaryCardProps): React.ReactElement | null {
  const { t } = useTranslation();
  const query = useStoredMissingListQuery(deckId);
  if (query.data === undefined) return null;

  const { summary, lines } = query.data;
  const totals = missingTotals(lines);
  if (totals.copies === 0) return null;

  const storeParts = [
    ...(summary.buyCopies > 0 ? [t('missingList.cardBuy', { count: summary.buyCopies, price: formatBrl(summary.buyCents) })] : []),
    ...(summary.lacksCopies > 0 ? [t('missingList.cardLacks', { count: summary.lacksCopies })] : []),
    ...(summary.notOnSiteCopies > 0 ? [t('missingList.cardOffSite', { count: summary.notOnSiteCopies })] : []),
  ];
  const title =
    totals.inventory > 0
      ? t('deckDetail.stripMissingCopies', {
          count: totals.copies,
          split: t('deckDetail.missingSplit', { deck: totals.deck, inventory: totals.inventory }),
        })
      : t('missingList.cardTitle', { count: totals.copies, cards: totals.cards });

  return (
    <section className={styles.card} aria-labelledby="deck-missing-card-title" data-testid="missing-summary-card">
      <p className={styles.eyebrow}>{t('missingList.cardEyebrow')}</p>
      <h2 id="deck-missing-card-title" className={styles.title}>
        {title}
      </h2>
      {storeParts.length > 0 && (
        <p className={styles.store}>
          {t('missingList.cardStorePrefix')}: {storeParts.join(' · ')}
        </p>
      )}
      <Link to="/decks/$deckId/missing" params={{ deckId: String(deckId) }} className={styles.link}>
        {t('missingList.cardLink')}
      </Link>
    </section>
  );
}

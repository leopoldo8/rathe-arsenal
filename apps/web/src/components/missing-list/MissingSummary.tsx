import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IMissingLine, IMissingSummary } from '../../api/missing-list';
import { formatBrl } from '../../utils/format-brl';
import { buySplit } from './missingListModel';
import styles from './MissingSummary.module.css';

interface IMissingSummaryProps {
  readonly summary: IMissingSummary;
  readonly lines: readonly IMissingLine[];
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** What is left to buy, what was already taken off, and once, how fresh the prices are. */
export function MissingSummary({ summary, lines }: IMissingSummaryProps): React.ReactElement {
  const { t } = useTranslation();
  const split = buySplit(lines);
  const discount =
    summary.ownedCopies > 0 && summary.standInCopies > 0
      ? t('missingList.discountedBoth', { count: summary.ownedCopies, standIn: summary.standInCopies })
      : summary.ownedCopies > 0
        ? t('missingList.discountedOwned', { count: summary.ownedCopies })
        : summary.standInCopies > 0
          ? t('missingList.discountedStandIn', { count: summary.standInCopies })
          : null;
  const note =
    summary.availabilityCheckedAt === null
      ? t('missingList.priceNoteNoPass', { days: summary.priceValidDays })
      : t('missingList.priceNote', { days: summary.priceValidDays, date: formatDay(summary.availabilityCheckedAt) });

  return (
    <div className={styles.summary} data-testid="missing-summary">
      <h1 className={styles.title}>
        {summary.buyCopies > 0
          ? t('missingList.buyTitle', { count: summary.buyCopies, price: formatBrl(summary.buyCents) })
          : t('missingList.buyTitleNothing')}
      </h1>
      {split.inventory > 0 && (
        <p className={styles.split} data-testid="shopping-split">
          {t('missingList.shoppingSplit', { deck: split.deck, inventory: split.inventory })}
        </p>
      )}
      {discount !== null && <p className={styles.discount}>{discount}</p>}
      {summary.lookingUp > 0 && <p className={styles.discount}>{t('missingList.stillLooking', { count: summary.lookingUp })}</p>}
      {summary.noPrice > 0 && <p className={styles.discount}>{t('missingList.withoutPrice', { count: summary.noPrice })}</p>}
      <p className={styles.note}>{note}</p>
    </div>
  );
}

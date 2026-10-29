import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useDeletedDecksQuery } from '../../api/deleted-decks';
import styles from './DeletedDecksRow.module.css';

/** "Excluídos recentemente (N) · ficam 30 dias": the way into the deleted decks, shown only while there are some. */
export function DeletedDecksRow(): React.ReactElement | null {
  const { t } = useTranslation();
  const count = useDeletedDecksQuery().data?.decks.length ?? 0;
  if (count === 0) return null;

  return (
    <Link to="/decks/deleted" className={styles.row} data-testid="deleted-decks-row">
      <span>{t('home.deletedRow', { count })}</span>
      <span className={styles.chevron} aria-hidden="true">›</span>
    </Link>
  );
}

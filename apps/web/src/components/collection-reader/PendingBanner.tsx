import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { usePendingLinesQuery } from '../../api/collection-imports';
import styles from './CollectionReader.module.css';

/** "11 linhas de colecao-lucas.csv para resolver": one banner per import that still has lines kept for later. */
export function PendingBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const query = usePendingLinesQuery();
  const imports = (query.data?.imports ?? []).filter((entry) => entry.lines.length > 0);
  if (imports.length === 0) return null;
  return (
    <>
      {imports.map((entry) => (
        <aside key={entry.sourceId} className={styles.pendingBanner} role="status">
          <p className={styles.pendingText}>
            {t('collectionReader.bannerText', { count: entry.lines.length, label: entry.label })}
          </p>
          <Link to="/library-pending" search={{ source: entry.sourceId }} className={styles.pendingAction}>
            {t('collectionReader.bannerResolve')}
          </Link>
        </aside>
      ))}
    </>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ICsvSource } from '../../api/csv-sources';
import { CsvSourceRow } from './CsvSourceRow';
import styles from './CsvSourceList.module.css';

interface ICsvSourceListProps {
  readonly sources: readonly ICsvSource[];
}

/**
 * CsvSourceList — renders a list of `kind='csv'` sources.
 * Does NOT handle the empty-state — the parent page is responsible for
 * rendering `CsvSourcesEmptyState` when sources.length === 0.
 */
export function CsvSourceList({ sources }: ICsvSourceListProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.list} role="list" aria-label={t('csvSources.csvSourcesListAriaLabel')}>
      {sources.map((source) => (
        <CsvSourceRow key={source.id} source={source} />
      ))}
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ICsvSource } from '../../api/csv-sources';
import { usePendingLinesQuery } from '../../api/collection-imports';
import { CsvSourceRow } from './CsvSourceRow';
import styles from './CsvSourceList.module.css';

interface ICsvSourceListProps {
  readonly sources: readonly ICsvSource[];
}

/**
 * CsvSourceList — renders the imports, each with the lines still kept "Para resolver".
 * Does NOT handle the empty-state — the parent page is responsible for
 * rendering `CsvSourcesEmptyState` when sources.length === 0.
 */
export function CsvSourceList({ sources }: ICsvSourceListProps): React.ReactElement {
  const { t } = useTranslation();
  const pending = usePendingLinesQuery();
  const pendingBySource = new Map((pending.data?.imports ?? []).map((entry) => [entry.sourceId, entry.lines.length]));
  return (
    <div className={styles.list} role="list" aria-label={t('csvSources.csvSourcesListAriaLabel')}>
      {sources.map((source) => (
        <CsvSourceRow key={source.id} source={source} pendingCount={pendingBySource.get(source.id) ?? 0} />
      ))}
    </div>
  );
}

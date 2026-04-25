import React from 'react';
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
  return (
    <div className={styles.list} role="list" aria-label="CSV sources">
      {sources.map((source) => (
        <CsvSourceRow key={source.id} source={source} />
      ))}
    </div>
  );
}

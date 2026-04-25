import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useCsvSourcesQuery } from '../../api/csv-sources';
import { CsvSourceList } from '../../components/csv-sources/CsvSourceList';
import { CsvSourcesEmptyState } from '../../components/csv-sources/CsvSourcesEmptyState';
import { UploadCsvButton } from '../../components/csv-sources/UploadCsvButton';
import { SumExplainer } from '../../components/csv-sources/SumExplainer';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import styles from './library-csv-sources.module.css';

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/_auth/library-csv-sources')({
  component: LibraryCsvSourcesPage,
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function LibraryCsvSourcesPage(): React.ReactElement {
  const sourcesQuery = useCsvSourcesQuery();

  if (sourcesQuery.isLoading) {
    return <CsvSourcesSkeleton />;
  }

  const sources = sourcesQuery.data ?? [];

  return (
    <div className={styles.page}>
      {/* Sticky page header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/library" className={styles.backLink} aria-label="Back to Library">
            ← Library
          </a>
          <h1 className={styles.title}>CSV Sources</h1>
          <div className={styles.headerActions}>
            <UploadCsvButton />
          </div>
        </div>
      </header>

      <main className={styles.content}>
        {/* Sum explainer collapsible */}
        <div className={styles.explainerRow}>
          <SumExplainer />
        </div>

        {/* Source list or empty state */}
        {sources.length === 0 ? (
          <CsvSourcesEmptyState
            onUpload={() => {
              // Programmatically trigger the file input by finding the label
              const fileInputLabel = document.querySelector<HTMLLabelElement>(
                'label[aria-label="Upload CSV file"]',
              );
              fileInputLabel?.click();
            }}
          />
        ) : (
          <CsvSourceList sources={sources} />
        )}

        {/* Error banner */}
        {sourcesQuery.isError && (
          <div role="alert" className={styles.errorBanner}>
            Failed to load CSV sources.{' '}
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => sourcesQuery.refetch()}
            >
              Retry
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function CsvSourcesSkeleton(): React.ReactElement {
  return (
    <div className={styles.page} aria-busy="true" aria-live="polite">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Skeleton width="80px" height="20px" aria-label="Loading back link" />
          <Skeleton width="160px" height="28px" aria-label="Loading title" />
          <Skeleton width="100px" height="36px" aria-label="Loading upload button" />
        </div>
      </header>
      <main className={styles.content}>
        <div className={styles.skeletonRows}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton width="36px" height="20px" aria-label="Loading toggle" />
              <Skeleton width="60%" height="20px" aria-label="Loading label" />
              <Skeleton width="80px" height="16px" aria-label="Loading count" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

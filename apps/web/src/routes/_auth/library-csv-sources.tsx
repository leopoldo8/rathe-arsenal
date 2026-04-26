import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCsvSourcesQuery } from '../../api/csv-sources';
import { CsvSourceList } from '../../components/csv-sources/CsvSourceList';
import { CsvSourcesEmptyState } from '../../components/csv-sources/CsvSourcesEmptyState';
import { UploadCsvButton } from '../../components/csv-sources/UploadCsvButton';
import { SumExplainer } from '../../components/csv-sources/SumExplainer';
import { RecentlyAddedBanner } from '../../components/library/RecentlyAddedBanner';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { DEFAULT_LIBRARY_SEARCH } from './library';
import styles from './library-csv-sources.module.css';

export const Route = createFileRoute('/_auth/library-csv-sources')({
  component: LibraryCsvSourcesPage,
});

function LibraryCsvSourcesPage(): React.ReactElement {
  const sourcesQuery = useCsvSourcesQuery();

  if (sourcesQuery.isLoading) {
    return <CsvSourcesSkeleton />;
  }

  const sources = sourcesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <Link to="/add-cards/csv" className={styles.backLink}>
        <span aria-hidden="true">←</span> Add cards · CSV
      </Link>

      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true">◆</span> Imports management
          </p>
          <h1 className={styles.title}>Library sources</h1>
          <p className={styles.subtitle}>
            Each source is a snapshot of cards you've imported — toggle one off
            to remove its contribution from your library without losing the
            file. Manual entries and Fabrary imports show up here too.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            to="/library"
            search={DEFAULT_LIBRARY_SEARCH}
            className={styles.viewLibraryLink}
          >
            <span aria-hidden="true">→</span> View library
          </Link>
          <UploadCsvButton />
        </div>
      </header>

      <RecentlyAddedBanner />

      <main className={styles.content}>
        <div className={styles.explainerRow}>
          <SumExplainer />
        </div>

        {sources.length === 0 ? (
          <CsvSourcesEmptyState
            onUpload={() => {
              // Programmatically trigger the upload button's hidden input.
              const fileInputLabel = document.querySelector<HTMLLabelElement>(
                'label[aria-label="Upload CSV file"]',
              );
              fileInputLabel?.click();
            }}
          />
        ) : (
          <CsvSourceList sources={sources} />
        )}

        {sourcesQuery.isError && (
          <div role="alert" className={styles.errorBanner}>
            Failed to load library sources.{' '}
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

function CsvSourcesSkeleton(): React.ReactElement {
  return (
    <div className={styles.page} aria-busy="true" aria-live="polite">
      <Skeleton width="120px" height="14px" aria-label="Loading back link" />
      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <Skeleton width="160px" height="14px" aria-label="Loading eyebrow" />
          <Skeleton width="240px" height="36px" aria-label="Loading title" />
          <Skeleton width="100%" height="48px" aria-label="Loading subtitle" />
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

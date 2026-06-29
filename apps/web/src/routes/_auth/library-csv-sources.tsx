import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCsvSourcesQuery } from '../../api/csv-sources';
import { CsvSourceList } from '../../components/csv-sources/CsvSourceList';
import { CsvSourcesEmptyState } from '../../components/csv-sources/CsvSourcesEmptyState';
import { UploadCsvButton } from '../../components/csv-sources/UploadCsvButton';
import { SumExplainer } from '../../components/csv-sources/SumExplainer';
import { RecentlyAddedBanner } from '../../components/library/RecentlyAddedBanner';
import { Skeleton } from '../../components/ui/Skeleton/Skeleton';
import { DEFAULT_LIBRARY_SEARCH } from './-library.helpers';
import styles from './library-csv-sources.module.css';

export const Route = createFileRoute('/_auth/library-csv-sources')({
  component: LibraryCsvSourcesPage,
});

function LibraryCsvSourcesPage(): React.ReactElement {
  const { t } = useTranslation();
  const sourcesQuery = useCsvSourcesQuery();

  if (sourcesQuery.isLoading) {
    return <CsvSourcesSkeleton />;
  }

  const sources = sourcesQuery.data ?? [];

  return (
    <div className={styles.page}>
      <Link to="/add-cards" className={styles.backLink}>
        <span aria-hidden="true">←</span> {t('csvSources.csvSourcesBackLink')}
      </Link>

      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true">◆</span> {t('csvSources.csvSourcesEyebrow')}
          </p>
          <h1 className={styles.title}>{t('csvSources.csvSourcesTitle')}</h1>
          <p className={styles.subtitle}>
            {t('csvSources.csvSourcesSubtitle')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            to="/library"
            search={DEFAULT_LIBRARY_SEARCH}
            className={styles.viewLibraryLink}
          >
            {t('csvSources.csvSourcesViewLibraryLink')}
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
              // Use a stable data attribute to find the upload trigger regardless of locale.
              const fileInputLabel = document.querySelector<HTMLLabelElement>(
                'label[data-upload-csv-trigger="true"]',
              );
              fileInputLabel?.click();
            }}
          />
        ) : (
          <CsvSourceList sources={sources} />
        )}

        {sourcesQuery.isError && (
          <div role="alert" className={styles.errorBanner}>
            {t('csvSources.csvSourcesErrorBanner')}{' '}
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => sourcesQuery.refetch()}
            >
              {t('csvSources.csvSourcesRetryButton')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function CsvSourcesSkeleton(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.page} aria-busy="true" aria-live="polite">
      <Skeleton width="120px" height="14px" aria-label={t('common.loadingBackLink')} />
      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <Skeleton width="160px" height="14px" aria-label={t('common.loadingEyebrow')} />
          <Skeleton width="240px" height="36px" aria-label={t('common.loadingTitle')} />
          <Skeleton width="100%" height="48px" aria-label={t('common.loadingSubtitle')} />
        </div>
      </header>
      <main className={styles.content}>
        <div className={styles.skeletonRows}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton width="36px" height="20px" aria-label={t('common.loadingToggle')} />
              <Skeleton width="60%" height="20px" aria-label={t('common.loadingLabel')} />
              <Skeleton width="80px" height="16px" aria-label={t('common.loadingCount')} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

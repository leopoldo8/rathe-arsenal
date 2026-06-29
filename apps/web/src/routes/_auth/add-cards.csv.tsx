import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useUploadCsvMutation } from '../../api/csv-sources';
import { ApiError } from '../../lib/api-client';
import { recordRecentlyAddedSource } from '../../components/library/RecentlyAddedBanner.helpers';
import styles from './add-cards.csv.module.css';

export const Route = createFileRoute('/_auth/add-cards/csv')({
  component: AddCardsCsvPage,
});

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The CSV subview now redirects on success, so it never sits in a "done"
 * state on this page. The state union covers the three states the page
 * actually displays: idle (drop zone), uploading (in flight), error.
 */
type TStatus =
  | { state: 'idle' }
  | { state: 'uploading'; filename: string }
  | { state: 'error'; message: string };

function AddCardsCsvPage(): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const upload = useUploadCsvMutation();

  const [status, setStatus] = useState<TStatus>({ state: 'idle' });
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File): void {
    if (file.size > MAX_BYTES) {
      setStatus({
        state: 'error',
        message: `File is over the 2 MB limit (${(file.size / 1024 / 1024).toFixed(2)} MB).`,
      });
      return;
    }
    setStatus({ state: 'uploading', filename: file.name });
    // Force `action: 'separate'` — every /add-cards/csv import lands as a
    // brand-new source. Dedup / merge belongs in /library-csv-sources.
    upload.mutate(
      { file, action: 'separate' },
      {
        onSuccess: (response) => {
          if (response.kind === 'created') {
            // Record the success payload, then bounce the user to the
            // sources list — that's where they manage what just landed.
            recordRecentlyAddedSource({
              kind: 'csv',
              label: file.name,
              cardCount: response.cardCount,
            });
            void navigate({ to: '/library-csv-sources' });
            return;
          }
          // The 'separate' action should never produce these other kinds
          // since the API only emits them for 'auto'. Fail loudly if it
          // does — we'd rather surface the surprise than silently swallow.
          setStatus({
            state: 'error',
            message: `Unexpected upload result: ${response.kind}`,
          });
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : (err as Error).message || 'Upload failed.';
          setStatus({ state: 'error', message });
        },
      },
    );
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>): void {
    if (e.currentTarget === e.target) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.currentTarget.files?.[0];
    if (file) handleFile(file);
    // Reset value so picking the same file again triggers change.
    e.currentTarget.value = '';
  }

  function reset(): void {
    setStatus({ state: 'idle' });
  }

  return (
    <div className={styles.page}>
      <header className={styles.subviewHeader}>
        <Link to="/add-cards" className={styles.back}>
          {t('csvSources.addCsvBackLink')}
        </Link>
        <p className={styles.eyebrow}>
          <span className={styles.numeral} aria-hidden="true">II</span> {t('csvSources.addCsvEyebrow')}
        </p>
        <h1 className={styles.title}>{t('csvSources.addCsvTitle')}</h1>
        <p className={styles.subtitle}>
          {t('csvSources.addCsvSubtitle')}
        </p>
      </header>

      <div
        ref={dropRef}
        className={`${styles.dropZone} ${isDragging ? styles['dropZone--active'] : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label={t('csvSources.addCsvDropZoneAriaLabel')}
      >
        <span className={styles.dropDiamond} aria-hidden="true">
          ◆
        </span>
        {status.state === 'uploading' ? (
          <p className={styles.dropTitle} aria-live="polite">
            {t('csvSources.addCsvUploadingLabel', { filename: status.filename })}
          </p>
        ) : (
          <>
            <p className={styles.dropTitle}>
              {isDragging
                ? t('csvSources.addCsvDragOverTitle')
                : t('csvSources.addCsvDropTitle')}
            </p>
            <p className={styles.dropHint}>
              {t('csvSources.addCsvDropHint')}
            </p>
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              className={styles.fileInput}
              onChange={handlePick}
            />
            <label htmlFor={inputId} className={styles.dropButton}>
              {t('csvSources.addCsvChooseFile')}
            </label>
          </>
        )}
      </div>

      {status.state === 'error' && (
        <section className={styles.errorCallout} role="alert">
          <p className={styles.errorTitle}>{t('csvSources.addCsvErrorTitle')}</p>
          <p className={styles.errorBody}>{status.message}</p>
          <button type="button" className={styles.secondaryAction} onClick={reset}>
            {t('csvSources.addCsvTryAnotherFile')}
          </button>
        </section>
      )}

      <footer className={styles.subviewFooter}>
        <Link to="/library-csv-sources" className={styles.manageLink}>
          {t('csvSources.addCsvManageLink')}
        </Link>
      </footer>
    </div>
  );
}

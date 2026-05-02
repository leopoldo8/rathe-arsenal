import React, { useId, useRef, useState } from 'react';
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
          <span aria-hidden="true">←</span> Add cards
        </Link>
        <p className={styles.eyebrow}>
          <span className={styles.numeral} aria-hidden="true">II</span> CSV import
        </p>
        <h1 className={styles.title}>Import a CSV</h1>
        <p className={styles.subtitle}>
          Drop a Fabrary or compatible CSV — name + quantity columns are required;
          set and pitch are optional.
        </p>
      </header>

      <div
        ref={dropRef}
        className={`${styles.dropZone} ${isDragging ? styles['dropZone--active'] : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="CSV drop zone"
      >
        <span className={styles.dropDiamond} aria-hidden="true">
          ◆
        </span>
        {status.state === 'uploading' ? (
          <p className={styles.dropTitle} aria-live="polite">
            Uploading <em>{status.filename}</em>…
          </p>
        ) : (
          <>
            <p className={styles.dropTitle}>
              {isDragging
                ? 'Release to upload.'
                : 'Drop a CSV here, or click to choose a file.'}
            </p>
            <p className={styles.dropHint}>
              Up to 2 MB. Each upload becomes a new toggleable source.
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
              Choose a file
            </label>
          </>
        )}
      </div>

      {status.state === 'error' && (
        <section className={styles.errorCallout} role="alert">
          <p className={styles.errorTitle}>Upload failed</p>
          <p className={styles.errorBody}>{status.message}</p>
          <button type="button" className={styles.secondaryAction} onClick={reset}>
            Try another file
          </button>
        </section>
      )}

      <footer className={styles.subviewFooter}>
        <Link to="/library-csv-sources" className={styles.manageLink}>
          → Manage existing CSV sources
        </Link>
      </footer>
    </div>
  );
}

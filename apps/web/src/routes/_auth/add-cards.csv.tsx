import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { setPendingImportFile } from '../../lib/pending-import-file';
import styles from './add-cards.csv.module.css';

export const Route = createFileRoute('/_auth/add-cards/csv')({
  component: AddCardsCsvPage,
});

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Choosing a file opens the report (`/add-cards/sheet`), which reads it with the one reader and shows
 * every line before anything is added. This page only holds the drop zone and the size check.
 */
type TStatus = { state: 'idle' } | { state: 'error'; message: string };

export function AddCardsCsvPage(): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const [status, setStatus] = useState<TStatus>({ state: 'idle' });
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File): void {
    if (file.size > MAX_BYTES) {
      setStatus({
        state: 'error',
        message: t('csvSources.csvOverSizeLimit', {
          size: (file.size / 1024 / 1024).toFixed(2),
        }),
      });
      return;
    }
    setPendingImportFile(file);
    void navigate({ to: '/add-cards/sheet' });
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
      <div
        ref={dropRef}
        className={`${styles.dropZone} ${isDragging ? styles['dropZone--active'] : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label={t('csvSources.addCsvDropZoneAriaLabel')}
      >
        <span className={styles.dropIcon} aria-hidden="true">
          ⇪
        </span>
        <p className={styles.dropTitle}>
          {isDragging ? t('csvSources.addCsvDragOverTitle') : t('csvSources.addCsvDropTitle')}
        </p>
        <p className={styles.dropHint}>{t('csvSources.csvSizeAndRowLimit')}</p>
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

      <Link to="/add-cards/list" className={styles.pasteLink}>
        {t('collectionReader.pasteLink')}
      </Link>

      <footer className={styles.subviewFooter}>
        <p className={styles.footerLine}>{t('csvSources.csvExpectedColumns')}</p>
      </footer>
    </div>
  );
}

import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useUploadCsvMutation,
  type IUploadCsvResponse,
  type TCsvUploadAction,
} from '../../api/csv-sources';
import { ApiError } from '../../lib/api-client';
import { useToast } from '../ui/Toast/useToast';
import { UploadResolveModal, type TResolveModalVariant } from './UploadResolveModal';
import styles from './UploadCsvButton.module.css';

interface IUploadCsvButtonProps {
  /** When provided, the button renders as a plain trigger for this handler. */
  readonly onTrigger?: () => void;
}

/**
 * UploadCsvButton — file picker that triggers the CSV upload flow.
 *
 * - While uploading: disabled + spinner + "Uploading {filename}…"
 * - On success with no skipped rows: success toast only (no modal).
 * - On success with skipped rows OR on exact-match / partial-overlap: opens
 *   `UploadResolveModal` with the appropriate variant.
 * - On network / validation error: error toast + reset file input.
 * - >2MB file: inline validation error; no network request.
 */
export function UploadCsvButton({ onTrigger }: IUploadCsvButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { show } = useToast();

  const [uploading, setUploading] = useState(false);
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  // Modal state
  const [modalResponse, setModalResponse] = useState<TResolveModalVariant | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const uploadMutation = useUploadCsvMutation();

  const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

  async function doUpload(
    file: File,
    action: TCsvUploadAction = 'auto',
    targetSourceId?: string,
  ): Promise<void> {
    setUploading(true);
    setUploadingFilename(file.name);
    setSizeError(null);

    const uploadVars: { file: File; action?: TCsvUploadAction; targetSourceId?: string } = { file };
    if (action !== 'auto') uploadVars.action = action;
    if (targetSourceId !== undefined) uploadVars.targetSourceId = targetSourceId;

    try {
      const result: IUploadCsvResponse = await uploadMutation.mutateAsync(uploadVars);

      // Determine what to do with the result.
      if (result.kind === 'cancelled') {
        // No-op
        return;
      }

      if (result.kind === 'exact-match' || result.kind === 'partial-overlap') {
        setPendingFile(file);
        setModalResponse(result);
        return;
      }

      // kind: created | updated | replaced
      if (result.skippedRows.length > 0) {
        // Open modal to show skipped rows, but the import DID succeed.
        setPendingFile(file);
        setModalResponse(result);
      } else {
        show({ kind: 'success', message: t('csvSources.uploadSuccessToast') });
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? t('csvSources.uploadFailedWithError', { error: err.message })
          : t('csvSources.uploadErrorDefault');
      show({ kind: 'error', message });
    } finally {
      setUploading(false);
      setUploadingFilename(null);
      // Reset the file input so the user can re-select the same file.
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setSizeError(t('csvSources.fileSizeError'));
      e.target.value = '';
      return;
    }

    setSizeError(null);
    void doUpload(file);
  }

  function handleModalAction(
    action: 'separate' | 'replace' | 'update' | 'cancel',
    targetSourceId?: string,
  ): void {
    setModalResponse(null);

    if (action === 'cancel' || pendingFile === null) return;

    void doUpload(pendingFile, action, targetSourceId);
    setPendingFile(null);
  }

  function handleModalClose(): void {
    setModalResponse(null);
    setPendingFile(null);
  }

  if (onTrigger !== undefined) {
    return (
      <button
        type="button"
        className={styles.btn}
        onClick={onTrigger}
        aria-label={t('csvSources.onTriggerAriaLabel')}
      >
        {t('csvSources.uploadButtonLabel')}
      </button>
    );
  }

  return (
    <>
      <label
        htmlFor={fileInputId}
        className={`${styles.btn} ${uploading ? styles.btnLoading : ''}`}
        aria-label={t('csvSources.uploadAriaLabel')}
        aria-busy={uploading}
        data-upload-csv-trigger="true"
      >
        {uploading ? (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <span>{t('csvSources.uploadingLabel', { filename: uploadingFilename ?? 'file' })}</span>
          </>
        ) : (
          t('csvSources.uploadButtonLabel')
        )}
      </label>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
        className={styles.fileInput}
        disabled={uploading}
        onChange={handleFileChange}
        aria-label={t('csvSources.fileInputAriaLabel')}
      />

      {sizeError !== null && (
        <p className={styles.sizeError} role="alert">
          {sizeError}
        </p>
      )}

      {modalResponse !== null && (
        <UploadResolveModal
          open
          response={modalResponse}
          onClose={handleModalClose}
          onAction={handleModalAction}
        />
      )}
    </>
  );
}

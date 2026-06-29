import React, { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import type { ICsvSource, IPreviewDeleteResult } from '../../api/csv-sources';
import {
  usePreviewDeleteCsvSource,
  useDeleteCsvSourceMutation,
} from '../../api/csv-sources';
import { useToast } from '../ui/Toast/useToast';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './DeleteSourceModal.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDeleteSourceModalProps {
  readonly open: boolean;
  readonly source: ICsvSource;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DeleteSourceModal — two-step destructive confirmation flow.
 *
 * Step 1: Shows impact preview (cardsRemoved + affected decks).
 * Step 2: User must type "DELETE" (case-sensitive) to enable Confirm.
 * During deletion: spinner + progress message.
 * On success: close + success toast.
 * On recomputeWarning: success + secondary warning toast.
 */
export function DeleteSourceModal({
  open,
  source,
  onClose,
  onDeleted,
}: IDeleteSourceModalProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const previewFetch = usePreviewDeleteCsvSource();
  const deleteMutation = useDeleteCsvSourceMutation();

  const [preview, setPreview] = useState<IPreviewDeleteResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const confirmInputId = useId();
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  const isConfirmed = confirmText === 'DELETE';
  const isDeleting = deleteMutation.isPending;

  // Load preview when modal opens
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewError(null);
      setConfirmText('');
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    previewFetch(source.id)
      .then((result) => {
        setPreview(result);
      })
      .catch((err: unknown) => {
        setPreviewError(t('csvSources.deletePreviewError'));
        void err;
      })
      .finally(() => {
        setLoadingPreview(false);
        // Focus the confirm input once preview loads
        requestAnimationFrame(() => confirmInputRef.current?.focus());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source.id]);

  async function handleConfirm(): Promise<void> {
    if (!isConfirmed || isDeleting) return;

    const label = source.label ?? source.originalFilename ?? 'CSV';

    try {
      const result = await deleteMutation.mutateAsync(source.id);
      onDeleted();
      show({ kind: 'success', message: t('csvSources.deleteSuccessToast', { label }) });
      if (result.recomputeWarning === true) {
        show({
          kind: 'info',
          message: t('csvSources.deleteWarningToast'),
        });
      }
    } catch (_err) {
      show({ kind: 'error', message: t('csvSources.deleteErrorToast') });
    }
  }

  const label = source.label ?? source.originalFilename ?? 'This CSV';
  const affectedCount = preview?.affectedDecks.length ?? 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !isDeleting) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title className={styles.title}>
            {t('csvSources.deleteModalTitle', { label })}
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            {t('csvSources.deleteModalDescription')}
          </Dialog.Description>

          {/* Step 1: Impact preview */}
          {loadingPreview ? (
            <div className={styles.previewSkeleton}>
              <Skeleton width="100%" height="20px" aria-label={t('common.loadingImpactPreview')} />
              <Skeleton width="80%" height="16px" aria-label={t('common.loadingImpactPreview')} />
            </div>
          ) : previewError !== null ? (
            <p className={styles.previewError} role="alert">{previewError}</p>
          ) : preview !== null ? (
            <div className={styles.preview}>
              <p className={styles.previewSummary}>
                {t('csvSources.deletePreviewSummaryPrefix')}{' '}
                <strong>{preview.cardsRemoved}</strong> card
                {preview.cardsRemoved !== 1 ? 's' : ''} {t('csvSources.deletePreviewSummarySuffix')}
                {affectedCount > 0 && (
                  <>
                    {' '}
                    {t('csvSources.deletePreviewDecksWarning', { count: affectedCount })}
                  </>
                )}
              </p>

              {preview.affectedDecks.length > 0 && (
                <ul className={styles.affectedDeckList} aria-label={t('csvSources.affectedDecksAriaLabel')}>
                  {preview.affectedDecks.map((deck) => (
                    <li key={deck.id} className={styles.affectedDeckItem}>
                      <span className={styles.deckName}>{deck.name}</span>
                      <span className={styles.deckPct}>
                        {Math.round(deck.currentEffectivePercent)}% ready
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/* Step 2: Type-to-confirm gate */}
          {isDeleting ? (
            <div className={styles.deletingMessage} role="status" aria-live="polite">
              <span className={styles.spinner} aria-hidden="true" />
              {t('csvSources.deletingMessagePrefix')}{' '}
              {affectedCount} deck{affectedCount !== 1 ? 's' : ''}{t('csvSources.deletingMessageSuffix')}
            </div>
          ) : (
            <div className={styles.confirmGate}>
              <label htmlFor={confirmInputId} className={styles.confirmLabel}>
                {t('csvSources.confirmInputLabelPre')} <strong>DELETE</strong> {t('csvSources.confirmInputLabelPost')}
              </label>
              <input
                ref={confirmInputRef}
                id={confirmInputId}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className={styles.confirmInput}
                aria-required="true"
                aria-describedby={`${confirmInputId}-hint`}
                placeholder="DELETE"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span id={`${confirmInputId}-hint`} className="sr-only">
                {t('csvSources.confirmInputSrOnlyHint')}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={isDeleting}
            >
              {t('csvSources.cancelButton')}
            </button>
            <button
              type="button"
              className={styles.btnDelete}
              onClick={() => { void handleConfirm(); }}
              aria-disabled={!isConfirmed || isDeleting}
              disabled={!isConfirmed || isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  {t('csvSources.deletingButton')}
                </>
              ) : (
                t('csvSources.deleteSourceButton')
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { usePatchDeckMutation, useUntrackDeckMutation } from '../../api/decks';
import styles from './DeckDangerZone.module.css';

interface IDeckDangerZoneProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly status: TDeckStatus;
  readonly onRetired: () => void;
}

export function DeckDangerZone({
  deckId,
  deckName,
  status,
  onRetired,
}: IDeckDangerZoneProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const patchMutation = usePatchDeckMutation(deckId);
  const untrackMutation = useUntrackDeckMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retireFailed, setRetireFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const isRetired = status === 'retired';

  function handleRetire(): void {
    setRetireFailed(false);
    patchMutation.mutate(
      { status: 'retired' },
      {
        onSuccess: onRetired,
        onError: () => setRetireFailed(true),
      },
    );
  }

  function handleDelete(): void {
    setDeleteFailed(false);
    untrackMutation.mutate(deckId, {
      onSuccess: () => {
        setConfirmOpen(false);
        void navigate({ to: '/home', search: { tag: [] } });
      },
      onError: () => setDeleteFailed(true),
    });
  }

  return (
    <section
      className={styles.zone}
      aria-labelledby="deck-edit-danger-title"
      data-testid="deck-danger-zone"
    >
      <h2 id="deck-edit-danger-title" className={styles.title}>
        {t('deckEdit.dangerTitle')}
      </h2>

      <div className={styles.row}>
        <div className={styles.copy}>
          <h3 className={styles.rowTitle}>{t('deckEdit.retireTitle')}</h3>
          <p className={styles.rowDesc}>
            {isRetired ? t('deckEdit.retiredNote') : t('deckEdit.retireDesc')}
          </p>
          {retireFailed && (
            <p className={styles.error} role="alert">
              {t('deckEdit.retireError')}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.retireBtn}
          disabled={isRetired || patchMutation.isPending}
          onClick={handleRetire}
          data-testid="deck-retire-btn"
        >
          {patchMutation.isPending ? t('deckEdit.retiring') : t('deckEdit.retireButton')}
        </button>
      </div>

      <div className={styles.row}>
        <div className={styles.copy}>
          <h3 className={styles.rowTitle}>{t('deckEdit.deleteTitle')}</h3>
          <p className={styles.rowDesc}>{t('deckEdit.deleteDesc')}</p>
        </div>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => {
            setDeleteFailed(false);
            setConfirmOpen(true);
          }}
          data-testid="deck-delete-btn"
        >
          {t('deckEdit.deleteButton')}
        </button>
      </div>

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.overlay} />
          <AlertDialog.Content className={styles.dialog} aria-describedby={undefined}>
            <AlertDialog.Title className={styles.dialogTitle}>
              {t('deckEdit.deleteConfirmTitle', { name: deckName })}
            </AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogDesc}>
              {t('deckEdit.deleteConfirmDesc')}
            </AlertDialog.Description>
            {deleteFailed && (
              <p className={styles.error} role="alert" data-testid="deck-delete-error">
                {t('deckEdit.deleteError')}
              </p>
            )}
            <div className={styles.dialogFooter}>
              <AlertDialog.Cancel asChild>
                <button type="button" className={styles.keepBtn} data-testid="deck-delete-cancel">
                  {t('deckEdit.deleteConfirmCancel')}
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                className={styles.confirmBtn}
                disabled={untrackMutation.isPending}
                onClick={handleDelete}
                data-testid="deck-delete-confirm"
              >
                {untrackMutation.isPending ? t('deckEdit.deleting') : t('deckEdit.deleteConfirmAction')}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

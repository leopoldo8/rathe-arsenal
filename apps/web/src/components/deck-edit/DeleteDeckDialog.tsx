import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';
import { useUntrackDeckMutation } from '../../api/decks';
import styles from './DeckDangerZone.module.css';

interface IDeleteDeckDialogProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DeleteDeckDialog({ deckId, deckName, open, onOpenChange }: IDeleteDeckDialogProps): React.ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const untrackMutation = useUntrackDeckMutation();
  const [deleteFailed, setDeleteFailed] = useState(false);

  function handleOpenChange(next: boolean): void {
    if (next) setDeleteFailed(false);
    onOpenChange(next);
  }

  function handleDelete(): void {
    setDeleteFailed(false);
    untrackMutation.mutate(deckId, {
      onSuccess: () => {
        onOpenChange(false);
        void navigate({ to: '/home', search: { tag: [] } });
      },
      onError: () => setDeleteFailed(true),
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
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
  );
}

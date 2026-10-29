import React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';
import styles from '../deck-edit/DeckDangerZone.module.css';

interface IPermanentDeleteDialogProps {
  readonly deckName: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** The one question before "Excluir de vez": open while a deck name is set, closed otherwise. */
export function PermanentDeleteDialog({ deckName, onConfirm, onCancel }: IPermanentDeleteDialogProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <AlertDialog.Root open={deckName !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.dialog} aria-describedby={undefined}>
          <AlertDialog.Title className={styles.dialogTitle}>
            {t('home.deletedConfirmTitle', { name: deckName ?? '' })}
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.dialogDesc}>{t('home.deletedConfirmDesc')}</AlertDialog.Description>
          <div className={styles.dialogFooter}>
            <AlertDialog.Cancel asChild>
              <button type="button" className={styles.keepBtn} data-testid="permanent-delete-cancel">
                {t('home.deletedConfirmCancel')}
              </button>
            </AlertDialog.Cancel>
            <button type="button" className={styles.confirmBtn} onClick={onConfirm} data-testid="permanent-delete-confirm">
              {t('home.deletedConfirmAction')}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

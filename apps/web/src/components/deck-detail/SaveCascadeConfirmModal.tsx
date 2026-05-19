/**
 * SaveCascadeConfirmModal — Radix AlertDialog that blocks Save when
 * N > 5 cascade-illegal cards exist in the composition draft (R21).
 *
 * Presents the count of illegal cards and asks the user to confirm or cancel.
 * Layout: [Cancel] [Confirm save]
 */
import React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import styles from './SaveCascadeConfirmModal.module.css';

interface ISaveCascadeConfirmModalProps {
  readonly open: boolean;
  /** Number of cascade-illegal cards (> 5 when this modal opens). */
  readonly illegalCount: number;
  /** Called when user confirms saving despite illegal cards. */
  readonly onConfirm: () => void;
  /** Called when user cancels (returns to Edit). */
  readonly onCancel: () => void;
}

export function SaveCascadeConfirmModal({
  open,
  illegalCount,
  onConfirm,
  onCancel,
}: ISaveCascadeConfirmModalProps): React.ReactElement {
  // Radix fires onOpenChange(false) on Escape — treat as Cancel.
  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen) {
      onCancel();
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content
          className={styles.content}
          aria-describedby={undefined}
        >
          <AlertDialog.Title className={styles.title}>
            {illegalCount} illegal {illegalCount === 1 ? 'card' : 'cards'} in this deck
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            This deck contains {illegalCount} card{illegalCount === 1 ? '' : 's'} that{' '}
            {illegalCount === 1 ? 'is' : 'are'} not legal in the selected format. You can
            still save, but the deck will be flagged as illegal.
          </AlertDialog.Description>

          <div className={styles.footer}>
            {/* Cancel — safe primary, left */}
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className={styles.cancelBtn}
                aria-label="Cancel"
                onClick={onCancel}
                data-testid="cascade-confirm-cancel-btn"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>

            {/* Confirm save — destructive secondary, right */}
            <AlertDialog.Action asChild>
              <button
                type="button"
                className={styles.confirmBtn}
                aria-label="Confirm save"
                onClick={onConfirm}
                data-testid="cascade-confirm-save-btn"
              >
                Confirm save
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * DraftRestoreModal — Radix AlertDialog that appears on Edit-mode entry
 * when a validated localStorage draft exists from a previous session.
 *
 * A11y spec:
 *  - Default focus: Restore button (via requestAnimationFrame), matching the
 *    DeleteAccountModal focus pattern.
 *  - Tab order: Restore → Discard → loop (focus-trap enforced by Radix).
 *  - Escape closes as Discard (Radix fires onOpenChange(false); we map to Discard).
 *  - After dismiss (either button), focus returns to the Edit-toggle button
 *    via returnFocusRef.
 *
 * Button layout: [Discard] [Restore] (Restore is the safe primary, rightmost).
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import styles from './DraftRestoreModal.module.css';

interface IDraftRestoreModalProps {
  readonly open: boolean;
  /** Called when the user clicks Restore (or presses Enter on the focused button). */
  readonly onRestore: () => void;
  /** Called when the user clicks Discard or presses Escape. */
  readonly onDiscard: () => void;
  /** Ref to the Edit-toggle button, to return focus after dismiss. */
  readonly returnFocusRef: React.RefObject<HTMLElement | null>;
}

export function DraftRestoreModal({
  open,
  onRestore,
  onDiscard,
  returnFocusRef,
}: IDraftRestoreModalProps): React.ReactElement {
  const { t } = useTranslation();
  const restoreRef = useRef<HTMLButtonElement | null>(null);
  // Track whether a button was explicitly clicked so that onOpenChange
  // doesn't double-fire the handler (Radix fires onOpenChange after the
  // action/cancel button click as well as on Escape).
  const handledRef = useRef(false);

  // Default focus on Restore when modal opens — matches DeleteAccountModal pattern.
  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    const raf = requestAnimationFrame(() => restoreRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Radix fires onOpenChange(false) on Escape (and after button clicks).
  // We only invoke onDiscard here for Escape — button paths set handledRef first.
  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && !handledRef.current) {
      // Escape key path: no button was clicked
      onDiscard();
    }
  }

  // After dismiss, return focus to the Edit-toggle button.
  function handleCloseAutoFocus(e: Event): void {
    e.preventDefault();
    returnFocusRef.current?.focus();
  }

  function handleRestore(): void {
    handledRef.current = true;
    onRestore();
  }

  function handleDiscard(): void {
    handledRef.current = true;
    onDiscard();
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content
          className={styles.content}
          onCloseAutoFocus={handleCloseAutoFocus}
          aria-describedby={undefined}
        >
          <AlertDialog.Title className={styles.title}>
            {t('decks.draftRestoreTitle')}
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            {t('decks.draftRestoreDesc')}
          </AlertDialog.Description>

          <div className={styles.footer}>
            {/* Discard — left, destructive secondary */}
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className={styles.discardBtn}
                aria-label={t('decks.discard')}
                onClick={handleDiscard}
                data-testid="draft-restore-discard-btn"
              >
                {t('decks.discard')}
              </button>
            </AlertDialog.Cancel>

            {/* Restore — right, safe primary; receives default focus */}
            <AlertDialog.Action asChild>
              <button
                ref={restoreRef}
                type="button"
                className={styles.restoreBtn}
                aria-label={t('decks.restore')}
                onClick={handleRestore}
                data-testid="draft-restore-restore-btn"
              >
                {t('decks.restore')}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

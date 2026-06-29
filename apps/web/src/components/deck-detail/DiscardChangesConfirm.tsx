/**
 * DiscardChangesConfirm — Radix AlertDialog that fires when the user
 * clicks Cancel (or navigates away) while the composition draft is dirty.
 *
 * A11y spec:
 *  - Default focus: "Keep editing" button (safe default — accidental Enter
 *    does NOT destroy unsaved work).
 *  - Tab order: Keep editing → Discard changes → loop (Radix focus-trap).
 *  - Escape closes as "Keep editing" (Radix fires onOpenChange(false); we map
 *    that to the keep handler).
 *  - Heading: "Discard {changeCount} changes?"
 *  - Body: "Your unsaved edits to this deck will be lost."
 *
 * Button layout: [Keep editing] [Discard changes]
 *   "Keep editing" is the safe primary (leftmost).
 *   "Discard changes" is the destructive secondary (rightmost).
 *
 * Touch targets are ≥ 44×44 on both buttons per .impeccable.md.
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import styles from './DiscardChangesConfirm.module.css';

interface IDiscardChangesConfirmProps {
  readonly open: boolean;
  /** Number of changes — renders in heading: "Discard {changeCount} changes?" */
  readonly changeCount: number;
  /** Called when user chooses to keep editing (safe action). */
  readonly onKeepEditing: () => void;
  /** Called when user confirms discarding changes. */
  readonly onDiscard: () => void;
}

export function DiscardChangesConfirm({
  open,
  changeCount,
  onKeepEditing,
  onDiscard,
}: IDiscardChangesConfirmProps): React.ReactElement {
  const { t } = useTranslation();
  const keepEditingRef = useRef<HTMLButtonElement | null>(null);
  // Track whether a button was explicitly clicked so that onOpenChange
  // doesn't double-fire the handler (Radix fires onOpenChange after the
  // action/cancel button click as well as on Escape).
  const handledRef = useRef(false);

  // Default focus on "Keep editing" on open — prevents accidental Enter-to-destroy.
  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    const raf = requestAnimationFrame(() => keepEditingRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Radix fires onOpenChange(false) on Escape (and after button clicks).
  // We only invoke onKeepEditing here for Escape — button paths set handledRef first.
  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && !handledRef.current) {
      // Escape key path: treat as "Keep editing" (safe default).
      onKeepEditing();
    }
  }

  function handleKeepEditing(): void {
    handledRef.current = true;
    onKeepEditing();
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
          aria-describedby={undefined}
        >
          <AlertDialog.Title className={styles.title}>
            {t('decks.discardCount', { count: changeCount })}
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            {t('decks.discardDesc')}
          </AlertDialog.Description>

          <div className={styles.footer}>
            {/* Keep editing — safe primary, left */}
            <AlertDialog.Cancel asChild>
              <button
                ref={keepEditingRef}
                type="button"
                className={styles.keepBtn}
                aria-label={t('decks.keepEditing')}
                onClick={handleKeepEditing}
                data-testid="discard-confirm-keep-btn"
              >
                {t('decks.keepEditing')}
              </button>
            </AlertDialog.Cancel>

            {/* Discard changes — destructive secondary, right */}
            <AlertDialog.Action asChild>
              <button
                type="button"
                className={styles.discardBtn}
                aria-label={t('decks.discardChanges')}
                onClick={handleDiscard}
                data-testid="discard-confirm-discard-btn"
              >
                {t('decks.discardChanges')}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

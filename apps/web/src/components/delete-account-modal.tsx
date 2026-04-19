import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';
import styles from './delete-account-modal.module.css';

interface IDeleteAccountModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}

/**
 * Unit 7 (Onda 3) — password-gated account deletion modal, restyled using
 * `@radix-ui/react-alert-dialog` for proper focus-trap and a11y.
 *
 * Preserved behaviour from Phase 1a Unit 2 (A8):
 *  - Requires re-entered password AND checkbox acknowledgement before the
 *    submit button enables.
 *  - HTTP 401 (wrong password) → inline error, modal stays open for retry.
 *  - HTTP 429 (rate limit) → shared rate-limit message, modal stays open.
 *  - On success, `onDeleted` fires; the caller handles post-delete navigation.
 *  - Escape key closes the modal (delegated to Radix AlertDialog).
 *  - Password input receives focus on open (via Radix `autoFocus` or ref).
 */
export function DeleteAccountModal({ open, onClose, onDeleted }: IDeleteAccountModalProps) {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordInputId = useId();
  const confirmCheckboxId = useId();
  const passwordRef = useRef<HTMLInputElement | null>(null);

  // Reset form state whenever the modal transitions from closed -> open so
  // a previous failed attempt does not bleed into the next session.
  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmed(false);
      setError(null);
      setPasswordError(null);
      // Focus the password input on open for keyboard-first users.
      // Radix handles initial focus inside the dialog; we nudge to the
      // password field specifically.
      const raf = requestAnimationFrame(() => passwordRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [open]);

  const submitDisabled = submitting || password.length === 0 || !confirmed;

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (submitDisabled) return;
    setSubmitting(true);
    setError(null);
    setPasswordError(null);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (err) {
      if (err instanceof AuthFetchError) {
        if (err.status === 401) {
          setPasswordError('Incorrect password');
        } else if (err.status === 429) {
          setError(formatRateLimitMessage(err.retryAfterSeconds));
        } else {
          setError(err.message || 'Could not delete your account. Please try again.');
        }
      } else {
        setError('Could not delete your account. Please try again.');
      }
      setSubmitting(false);
    }
  }

  // Radix AlertDialog does not expose an `onClose` prop — it fires
  // `onOpenChange(false)` when the user dismisses the dialog. We map
  // that to `onClose` from the parent, guarding against submission.
  function handleOpenChange(nextOpen: boolean): void {
    if (!nextOpen && !submitting) onClose();
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={styles.overlay} />
        <AlertDialog.Content className={styles.content} aria-describedby={undefined}>
          <AlertDialog.Title className={styles.title}>
            Delete your account
          </AlertDialog.Title>
          <AlertDialog.Description className={styles.description}>
            Your account and all linked data (collection, tracked decks,
            readiness history) will be permanently deleted after 30 days. You
            will be signed out immediately.
          </AlertDialog.Description>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor={passwordInputId} className={styles.fieldLabel}>
                Re-enter your password
              </label>
              <input
                ref={passwordRef}
                id={passwordInputId}
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={submitting}
                aria-invalid={passwordError !== null}
                aria-describedby={passwordError ? `${passwordInputId}-error` : undefined}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                className={styles.passwordInput}
              />
              {passwordError && (
                <div
                  id={`${passwordInputId}-error`}
                  role="alert"
                  className={styles.fieldError}
                >
                  {passwordError}
                </div>
              )}
            </div>

            <div className={styles.checkboxRow}>
              <input
                id={confirmCheckboxId}
                type="checkbox"
                checked={confirmed}
                disabled={submitting}
                onChange={(e) => setConfirmed(e.target.checked)}
                className={styles.checkboxInput}
              />
              <label htmlFor={confirmCheckboxId} className={styles.checkboxLabel}>
                I understand my account and all data will be permanently deleted
              </label>
            </div>

            {error && (
              <div role="alert" className={styles.errorBanner}>
                {error}
              </div>
            )}

            <div className={styles.footer}>
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  disabled={submitting}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                type="submit"
                disabled={submitDisabled}
                aria-disabled={submitDisabled}
                className={styles.submitBtn}
              >
                {submitting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

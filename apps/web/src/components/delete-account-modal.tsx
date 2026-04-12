import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';

interface IDeleteAccountModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}

/**
 * Phase 1a Unit 2 (A8) — password-gated account deletion modal.
 *
 * - Requires the user to re-enter their password and explicitly acknowledge
 *   the permanent deletion via a checkbox before the submit button enables.
 * - On HTTP 401 (wrong password) the modal stays open with an inline error
 *   under the password input so the user can retry without re-opening.
 * - On HTTP 429 (rate limit) the modal stays open with the shared
 *   rate-limit message derived from the `Retry-After` header.
 * - On success, `onDeleted` fires and the caller is responsible for the
 *   post-delete navigation (typically a redirect to `/`). The `AuthProvider`
 *   has already cleared the JWT and user by this point.
 *
 * The modal is rendered inline with hand-styled overlay/positioning to
 * match the existing inline-style convention in `__root.tsx` and
 * `empty-home-state.tsx` — no new CSS framework is introduced for this
 * single surface.
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
  const titleId = useId();
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
      const raf = requestAnimationFrame(() => passwordRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [open]);

  // Close on Escape. Only attach when the modal is open to avoid competing
  // with other Escape handlers on the page.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const submitDisabled = submitting || password.length === 0 || !confirmed;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        // Close when clicking the backdrop, but not when clicking inside
        // the modal card. Submitting locks the close to avoid orphaned
        // in-flight requests.
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
          padding: '1.5rem',
          width: 'min(440px, 92vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 id={titleId} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
          Delete your account
        </h2>
        <p style={{ color: '#555', marginTop: 0 }}>
          Your account and all linked data (collection, tracked decks, readiness
          history) will be permanently deleted after 30 days. You will be signed
          out immediately.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginTop: '1rem' }}>
            <label
              htmlFor={passwordInputId}
              style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}
            >
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
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                border: `1px solid ${passwordError ? '#c0392b' : '#ccc'}`,
                borderRadius: '4px',
                boxSizing: 'border-box',
              }}
            />
            {passwordError && (
              <div
                id={`${passwordInputId}-error`}
                role="alert"
                style={{ color: '#c0392b', fontSize: '0.8125rem', marginTop: '0.375rem' }}
              >
                {passwordError}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <input
              id={confirmCheckboxId}
              type="checkbox"
              checked={confirmed}
              disabled={submitting}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ marginTop: '0.25rem' }}
            />
            <label htmlFor={confirmCheckboxId} style={{ fontSize: '0.875rem', color: '#333' }}>
              I understand my account and all data will be permanently deleted
            </label>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                color: '#c0392b',
                fontSize: '0.875rem',
                marginTop: '0.875rem',
                padding: '0.5rem 0.75rem',
                background: '#fdecea',
                border: '1px solid #f5c6c1',
                borderRadius: '4px',
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '0.5rem 0.875rem', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              aria-disabled={submitDisabled}
              style={{
                padding: '0.5rem 0.875rem',
                cursor: submitDisabled ? 'not-allowed' : 'pointer',
                background: submitDisabled ? '#e0a6a0' : '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {submitting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

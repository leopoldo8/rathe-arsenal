/**
 * ImportFabraryCard — card for importing a deck from a Fabrary URL.
 *
 * Lifted from the original single-page DecksNewPage. Accepts a Fabrary deck
 * URL, calls useImportDecksMutation, and on success navigates to the deck
 * detail page in View mode.
 */
import React, { useId, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useImportDecksMutation } from '../../api/decks';
import { ApiError } from '../../lib/api-client';
import styles from './ImportFabraryCard.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const URL_REGEX = /^https?:\/\/(www\.)?fabrary\.net\/decks\/[A-Za-z0-9]+/;

/**
 * Maps a backend Fabrary import error code to a user-facing message.
 * Falls back to the backend message (then a generic line) for unknown codes.
 */
function messageForImportError(code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_URL':
    case 'INVALID_ULID':
      return 'That does not look like a valid Fabrary deck URL.';
    case 'FETCH_FAILED':
    case 'CREDENTIAL_EXPIRED':
      return 'We could not reach Fabrary to fetch that deck. Please try again in a moment.';
    case 'INVALID_PAYLOAD':
    case 'UNKNOWN_CARD':
      return 'We could not read that Fabrary deck — it may use cards we do not support yet.';
    default:
      return fallback || 'We could not track this deck. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Status type
// ---------------------------------------------------------------------------

type TStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'error'; message: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ImportFabraryCard — paste-URL card for tracking a deck from Fabrary.
 *
 * On success, navigates to the deck detail page in View mode
 * (`/decks/:deckId` without `edit` search param).
 */
export function ImportFabraryCard(): React.ReactElement {
  const inputId = useId();
  const helpId = useId();
  const importMutation = useImportDecksMutation();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<TStatus>({ state: 'idle' });

  const trimmed = url.trim();
  const localValid = URL_REGEX.test(trimmed);

  function submit(): void {
    if (!localValid) {
      setStatus({
        state: 'error',
        message: 'Not a valid Fabrary deck URL — expected https://fabrary.net/decks/…',
      });
      return;
    }
    setStatus({ state: 'submitting' });
    importMutation.mutate(
      { urls: [trimmed] },
      {
        onSuccess: (result) => {
          const imported = result.imported[0];
          if (imported) {
            void navigate({
              to: '/decks/$deckId',
              params: { deckId: String(imported.trackedDeckId) },
              search: { edit: undefined },
            });
            return;
          }

          // No deck imported — surface why instead of silently redirecting.
          const failed = result.errors[0];
          if (failed) {
            setStatus({
              state: 'error',
              message: messageForImportError(failed.code, failed.message),
            });
            return;
          }

          const skippedDeck = result.skipped[0];
          if (skippedDeck) {
            setStatus({
              state: 'error',
              message:
                skippedDeck.reason === 'ALREADY_TRACKED'
                  ? 'You are already tracking this deck.'
                  : 'This deck was skipped and not tracked.',
            });
            return;
          }

          setStatus({
            state: 'error',
            message: 'We could not track this deck. Please try again.',
          });
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : (err as Error).message || 'Failed to track deck.';
          setStatus({ state: 'error', message });
        },
      },
    );
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && status.state !== 'submitting') {
      submit();
    }
  }

  return (
    <div className={styles.card} data-testid="import-fabrary-card">
      <h2 className={styles.cardTitle}>Import from Fabrary</h2>
      <p className={styles.cardSubtitle}>
        Paste a Fabrary deck URL — we&apos;ll track it and run readiness analysis.
      </p>

      <div className={styles.form}>
        <label className={styles.label} htmlFor={inputId}>
          Fabrary deck URL
        </label>
        <input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://fabrary.net/decks/…"
          value={url}
          onChange={(e) => {
            setUrl(e.currentTarget.value);
            if (status.state === 'error') setStatus({ state: 'idle' });
          }}
          onKeyDown={onKey}
          className={styles.input}
          aria-describedby={helpId}
          aria-invalid={status.state === 'error'}
          disabled={status.state === 'submitting'}
        />
        <p id={helpId} className={styles.helpText}>
          Public Fabrary deck links work — e.g. a community brew someone shared
          with you.
        </p>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={submit}
          disabled={status.state === 'submitting' || trimmed.length === 0}
        >
          {status.state === 'submitting' ? 'Tracking…' : 'Track deck'}
        </button>
      </div>

      {status.state === 'submitting' && (
        <p className={styles.progress} role="status" aria-live="polite">
          <span className={styles.progressDiamond} aria-hidden="true">◆</span>
          Deck tracked. Redirecting…
        </p>
      )}

      {status.state === 'error' && (
        <section className={styles.errorCallout} role="alert">
          <p className={styles.errorTitle}>Failed to track deck:</p>
          <p className={styles.errorBody}>{status.message}</p>
        </section>
      )}
    </div>
  );
}

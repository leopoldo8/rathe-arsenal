/**
 * ImportFabraryCard — card for importing a deck from a Fabrary URL.
 *
 * Lifted from the original single-page DecksNewPage. Accepts a Fabrary deck
 * URL, calls useImportDecksMutation, and on success navigates to the deck
 * detail page in View mode.
 */
import React, { useId, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
function messageForImportError(t: TFunction, code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_URL':
    case 'INVALID_ULID':
      return t('decks.invalidFabraryUrlLocal');
    case 'FETCH_FAILED':
    case 'CREDENTIAL_EXPIRED':
      return t('decks.fabraryFetchFailed');
    case 'INVALID_PAYLOAD':
    case 'UNKNOWN_CARD':
      return t('decks.fabraryInvalidDeck');
    default:
      return fallback || t('decks.couldNotTrackDeck');
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
  const { t } = useTranslation();
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
        message: t('decks.invalidFabraryUrlLocal'),
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
              message: messageForImportError(t, failed.code, failed.message),
            });
            return;
          }

          const skippedDeck = result.skipped[0];
          if (skippedDeck) {
            setStatus({
              state: 'error',
              message:
                skippedDeck.reason === 'ALREADY_TRACKED'
                  ? t('decks.alreadyTrackingDeck')
                  : t('decks.deckSkipped'),
            });
            return;
          }

          setStatus({
            state: 'error',
            message: t('decks.couldNotTrackDeck'),
          });
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : (err as Error).message || t('decks.couldNotTrackDeck');
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
      <h2 className={styles.cardTitle}>{t('decks.importFromFabrary')}</h2>
      <p className={styles.cardSubtitle}>
        {t('decks.importFabrarySubtitle')}
      </p>

      <div className={styles.form}>
        <label className={styles.label} htmlFor={inputId}>
          {t('decks.fabraryDeckUrlLabel')}
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
          {t('decks.fabraryUrlHelp')}
        </p>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={submit}
          disabled={status.state === 'submitting' || trimmed.length === 0}
        >
          {status.state === 'submitting' ? t('decks.trackingDeckBtn') : t('decks.trackDeckBtn')}
        </button>
      </div>

      {status.state === 'submitting' && (
        <p className={styles.progress} role="status" aria-live="polite">
          <span className={styles.progressDiamond} aria-hidden="true">◆</span>
          {t('decks.deckTrackedRedirecting')}
        </p>
      )}

      {status.state === 'error' && (
        <section className={styles.errorCallout} role="alert">
          <p className={styles.errorTitle}>{t('decks.failedToTrackDeck')}</p>
          <p className={styles.errorBody}>{status.message}</p>
        </section>
      )}
    </div>
  );
}

import React, { useId, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useImportDecksMutation } from '../../api/decks';
import { ApiError } from '../../lib/api-client';
import styles from './add-cards.fabrary.module.css';

export const Route = createFileRoute('/_auth/decks/new')({
  component: DecksNewPage,
});

export { DecksNewPage };

const URL_REGEX = /^https?:\/\/(www\.)?fabrary\.net\/decks\/[A-Za-z0-9]+/;

/**
 * Status union for the track-deck form. Three render states:
 * idle, submitting, or error.
 */
type TStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'error'; message: string };

/**
 * DecksNewPage — /decks/new
 *
 * Tracks a Fabrary deck (not a card-only library import). On success,
 * navigates to the deck detail page `/decks/:deckId`.
 *
 * Distinct from /add-cards/fabrary which imports cards into the library
 * without tracking a deck (cards-only path).
 */
function DecksNewPage(): React.ReactElement {
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
            });
          } else {
            // Deck was skipped (already tracked) — navigate to home
            void navigate({ to: '/home', search: { tag: [] } });
          }
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
    <div className={styles.page}>
      <header className={styles.subviewHeader}>
        <Link to="/home" search={{ tag: [] }} className={styles.back}>
          <span aria-hidden="true">←</span> Home
        </Link>
        <h1 className={styles.title}>Track a deck</h1>
        <p className={styles.subtitle}>
          Paste a Fabrary deck URL — we&apos;ll track it and run readiness analysis.
        </p>
      </header>

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
          autoFocus
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

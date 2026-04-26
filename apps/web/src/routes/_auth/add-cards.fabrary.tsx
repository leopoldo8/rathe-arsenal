import React, { useId, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  useFabraryLibraryImportMutation,
  type IFabraryLibraryImportResponse,
} from '../../api/fabrary-import';
import { ApiError } from '../../lib/api-client';
import { DEFAULT_LIBRARY_SEARCH } from './library';
import styles from './add-cards.fabrary.module.css';

export const Route = createFileRoute('/_auth/add-cards/fabrary')({
  component: AddCardsFabraryPage,
});

export { AddCardsFabraryPage };

const URL_REGEX = /^https?:\/\/(www\.)?fabrary\.net\/decks\/[A-Za-z0-9]+/;

type TStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; result: IFabraryLibraryImportResponse }
  | { state: 'error'; message: string };

function AddCardsFabraryPage(): React.ReactElement {
  const inputId = useId();
  const helpId = useId();
  const importMutation = useFabraryLibraryImportMutation();
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
      { url: trimmed },
      {
        onSuccess: (result) => setStatus({ state: 'success', result }),
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : (err as Error).message || 'Import failed.';
          setStatus({ state: 'error', message });
        },
      },
    );
  }

  function reset(): void {
    setStatus({ state: 'idle' });
    setUrl('');
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && status.state !== 'submitting') {
      submit();
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.subviewHeader}>
        <Link to="/add-cards" className={styles.back}>
          <span aria-hidden="true">←</span> Add cards
        </Link>
        <p className={styles.eyebrow}>
          <span className={styles.numeral} aria-hidden="true">III</span> Fabrary deck
        </p>
        <h1 className={styles.title}>Import from Fabrary</h1>
        <p className={styles.subtitle}>
          We import the cards, not the deck. The Fabrary deck stays where it is —
          your library gets a new source with every card the deck uses.
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
          {status.state === 'submitting' ? 'Importing…' : 'Import to library'}
        </button>
      </div>

      {status.state === 'submitting' && (
        <p className={styles.progress} role="status" aria-live="polite">
          <span className={styles.progressDiamond} aria-hidden="true">◆</span>
          Fetching deck → parsing cards → adding to library…
        </p>
      )}

      {status.state === 'success' && (
        <section className={styles.success} role="status" aria-live="polite">
          <p className={styles.successTitle}>
            <span aria-hidden="true">◆</span> Added{' '}
            <strong>{status.result.cardCount}</strong> cards as new source:{' '}
            <em>{status.result.deckName}</em>.
          </p>
          <p className={styles.successMeta}>
            {status.result.uniqueCardCount} unique identifiers · format:{' '}
            {status.result.format}
          </p>
          <div className={styles.successActions}>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={reset}
            >
              Import another
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => {
                void navigate({ to: '/library', search: DEFAULT_LIBRARY_SEARCH });
              }}
            >
              View library
            </button>
          </div>
        </section>
      )}

      {status.state === 'error' && (
        <section className={styles.errorCallout} role="alert">
          <p className={styles.errorTitle}>Import failed</p>
          <p className={styles.errorBody}>{status.message}</p>
        </section>
      )}
    </div>
  );
}

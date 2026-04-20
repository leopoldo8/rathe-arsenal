import React, { useId, useRef, useState } from 'react';
import { Button } from '../ui/Button/Button';
import { useImportDecksMutation, IImportDecksResponse } from '../../api/decks';
import styles from './Step1PasteUrl.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex for basic Fabrary deck URL shape. */
const FABRARY_URL_REGEX = /^https?:\/\/(www\.)?fabrary\.net\/decks\/[A-Za-z0-9]+/;

/** Timeout before showing the "unreachable" error, in milliseconds. */
const UNREACHABLE_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IStep1Result {
  readonly importedDecks: IImportDecksResponse['imported'];
  readonly urls: readonly string[];
}

export interface IStep1PasteUrlProps {
  readonly onComplete: (result: IStep1Result) => void;
  readonly onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a user-facing validation error string for the given URL string,
 * or null if the URL is valid in format.
 */
function validateUrlFormat(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null; // empty = not yet entered
  if (!FABRARY_URL_REGEX.test(trimmed)) {
    return 'Must be a valid Fabrary deck URL (e.g. https://fabrary.net/decks/…)';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Step 1 of the onboarding wizard — paste a Fabrary deck URL.
 *
 * Validation rules:
 *  - Invalid URL format: shown immediately on input.
 *  - Unreachable URL: shown after 5s timeout (AbortController).
 *  - Private deck: backend returns code='private_deck'.
 *  - Non-FaB deck: backend returns code='not_fab_deck'.
 *
 * Skip always routes to /home (handled by parent wizard).
 */
export function Step1PasteUrl({ onComplete, onSkip }: IStep1PasteUrlProps): React.ReactElement {
  const [url, setUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const inputId = useId();
  const errorId = useId();

  const importMutation = useImportDecksMutation();

  const formatError = validateUrlFormat(url);
  const hasUrl = url.trim().length > 0;
  const canSubmit = hasUrl && !formatError && !importMutation.isPending;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setUrl(e.target.value);
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitError(null);

    // AbortController to implement the 5s timeout for unreachable URLs.
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutHandle = setTimeout(() => {
      controller.abort();
      setSubmitError(
        'That URL took too long to respond — the deck may be unreachable or the server is unavailable.',
      );
    }, UNREACHABLE_TIMEOUT_MS);

    try {
      const response = await importMutation.mutateAsync({ urls: [url.trim()] });
      clearTimeout(timeoutHandle);

      if (controller.signal.aborted) return;

      // Check for backend errors on this URL
      const urlError = response.errors[0];
      if (urlError) {
        const code = urlError.code;
        if (code === 'private_deck') {
          setSubmitError(
            'That deck is set to private on Fabrary. Make it public or use a different URL.',
          );
          return;
        }
        if (code === 'not_fab_deck') {
          setSubmitError('That URL does not appear to be a Flesh and Blood deck.');
          return;
        }
        setSubmitError(urlError.message);
        return;
      }

      // Skipped: already tracked
      const skipped = response.skipped[0];
      if (skipped) {
        setSubmitError(`Deck already tracked: ${skipped.reason}`);
        return;
      }

      onComplete({ importedDecks: response.imported, urls: [url.trim()] });
    } catch (error) {
      clearTimeout(timeoutHandle);
      if (controller.signal.aborted) {
        // Timeout message already set above
        return;
      }
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to import deck. Please try again.',
      );
    } finally {
      abortRef.current = null;
    }
  }

  const displayError = formatError ?? submitError;
  const hasError = displayError !== null;

  return (
    <div className={styles.step}>
      <div className={styles.eyebrow}>Step 1 of 3</div>
      <h1 className={styles.heading}>First, a deck</h1>
      <p className={styles.body}>
        Paste any Fabrary deck URL. We will use it to understand what you want to play and how
        ready your collection is.
      </p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor={inputId}>
            Fabrary deck URL
          </label>
          <input
            id={inputId}
            type="url"
            className={[styles.input, hasError ? styles['input--error'] : ''].filter(Boolean).join(' ')}
            placeholder="https://fabrary.net/decks/…"
            value={url}
            onChange={handleChange}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            autoComplete="off"
            autoFocus
          />
          {hasError && (
            <span id={errorId} className={styles.errorMessage} role="alert">
              {displayError}
            </span>
          )}
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={importMutation.isPending}
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            loading={importMutation.isPending}
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}

import React, { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button/Button';
import { useFabraryPreviewQuery, useImportFabraryDeckMutation } from '../../api/fabrary-import';
import { findFabraryDeckId } from '../../lib/fabrary-link';
import { FabraryOwnership } from '../fabrary-import/FabraryOwnership';
import { localizeApiError } from '../card-scanner/localize-api-error';
import type { TImportedDeck } from './Step2ConfirmLibrary';
import styles from './Step1PasteUrl.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout before showing the "unreachable" error, in milliseconds. */
const UNREACHABLE_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IStep1Result {
  readonly importedDecks: readonly TImportedDeck[];
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
 * Returns true if the URL has a valid Fabrary deck URL format, or the URL is empty.
 * Empty string is not an error (user hasn't typed yet).
 */
function isValidFabraryFormat(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return findFabraryDeckId(trimmed) !== null;
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
 *  - Missing or private deck: the preview answers 404.
 *  - Once the deck is found, the player says whether the cards are theirs before continuing.
 *
 * Skip always routes to /home (handled by parent wizard).
 */
export function Step1PasteUrl({ onComplete, onSkip }: IStep1PasteUrlProps): React.ReactElement {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const inputId = useId();
  const errorId = useId();

  const importMutation = useImportFabraryDeckMutation();
  const [ownsCards, setOwnsCards] = useState<boolean | null>(null);
  const ownershipName = useId();

  const urlIsValid = isValidFabraryFormat(url);
  const formatError = urlIsValid ? null : t('onboarding.step1FormatError');
  const hasUrl = url.trim().length > 0;
  const preview = useFabraryPreviewQuery(urlIsValid && hasUrl ? url.trim() : '');
  const deck = preview.data;
  const previewError = urlIsValid && hasUrl && preview.isError ? localizeApiError(preview.error, t) : null;
  const canSubmit = hasUrl && urlIsValid && deck !== undefined && ownsCards !== null && !importMutation.isPending;

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
      setSubmitError(t('onboarding.step1TimeoutError'));
    }, UNREACHABLE_TIMEOUT_MS);

    try {
      const response = await importMutation.mutateAsync({ text: url.trim(), ownsCards: ownsCards === true });
      clearTimeout(timeoutHandle);

      if (controller.signal.aborted) return;

      onComplete({
        importedDecks: [
          {
            trackedDeckId: response.deckId,
            name: deck?.name ?? '',
            hero: deck?.hero ?? '',
            format: deck?.format ?? '',
            readinessSnapshot: null,
          },
        ],
        urls: [url.trim()],
      });
    } catch (error) {
      clearTimeout(timeoutHandle);
      if (controller.signal.aborted) {
        // Timeout message already set above
        return;
      }
      setSubmitError(localizeApiError(error, t));
    } finally {
      abortRef.current = null;
    }
  }

  const displayError = formatError ?? previewError ?? submitError;
  const hasError = displayError !== null;

  return (
    <div className={styles.step}>
      <div className={styles.eyebrow}>{t('onboarding.step1Eyebrow')}</div>
      <h1 className={styles.heading}>{t('onboarding.step1Heading')}</h1>
      <p className={styles.body}>{t('onboarding.step1Body')}</p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor={inputId}>
            {t('onboarding.step1Label')}
          </label>
          <input
            id={inputId}
            type="url"
            className={[styles.input, hasError ? styles['input--error'] : ''].filter(Boolean).join(' ')}
            placeholder={t('onboarding.step1Placeholder')}
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

        {deck !== undefined && (
          <>
            <p className={styles.body}>
              {t('fabraryImport.foundTitle', { name: deck.name, count: deck.totalCards })}
              {' · '}
              {t('fabraryImport.youHave', { owned: deck.ownedCards, count: deck.totalCards })}
            </p>
            <FabraryOwnership value={ownsCards} onChange={setOwnsCards} name={ownershipName} />
          </>
        )}

        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={importMutation.isPending}
          >
            {t('onboarding.skipForNow')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            loading={importMutation.isPending}
          >
            {t('onboarding.continueButton')}
          </Button>
        </div>
      </form>
    </div>
  );
}

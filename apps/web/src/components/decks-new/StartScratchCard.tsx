/**
 * StartScratchCard — card for creating a new deck from scratch.
 *
 * Presents HeroDropdown + FormatDropdown. The "Start building" button is
 * disabled until both fields are set. On submit, calls
 * useCreateScratchDeckMutation and navigates to the deck detail page in
 * Edit mode (/decks/:deckId?edit=1).
 *
 * Reuses:
 *  - HeroDropdown from apps/web/src/components/deck-detail/HeroDropdown.tsx
 *  - FormatDropdown from apps/web/src/components/deck-detail/FormatDropdown.tsx
 */
import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCreateScratchDeckMutation } from '../../api/decks';
import { ApiError } from '../../lib/api-client';
import { HeroDropdown } from '../deck-detail/HeroDropdown';
import { FormatDropdown } from '../deck-detail/FormatDropdown';
import styles from './StartScratchCard.module.css';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StartScratchCard — hero + format selection to create a blank deck.
 *
 * On success, navigates to /decks/:deckId?edit=1 (Edit mode) so the user
 * can start building immediately.
 */
export function StartScratchCard(): React.ReactElement {
  const navigate = useNavigate();
  const createMutation = useCreateScratchDeckMutation();

  const [heroIdentifier, setHeroIdentifier] = useState<string | null>(null);
  const [format, setFormat] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = heroIdentifier !== null && format.length > 0;
  const isSubmitting = createMutation.isPending;

  function handleSubmit(): void {
    if (!canSubmit) return;
    setErrorMessage(null);
    createMutation.mutate(
      { heroIdentifier, format },
      {
        onSuccess: (result) => {
          void navigate({
            to: '/decks/$deckId',
            params: { deckId: String(result.id) },
            search: { edit: '1' },
          });
        },
        onError: (err) => {
          const message =
            err instanceof ApiError
              ? err.message
              : (err as Error).message || 'Failed to create deck.';
          setErrorMessage(message);
        },
      },
    );
  }

  return (
    <div className={styles.card} data-testid="start-scratch-card">
      <h2 className={styles.cardTitle}>Start from scratch</h2>
      <p className={styles.cardSubtitle}>
        Pick a hero and format — we&apos;ll create a blank deck ready to build.
      </p>

      <div className={styles.fields}>
        <HeroDropdown
          value={heroIdentifier}
          onChange={(id) => {
            setHeroIdentifier(id);
            setErrorMessage(null);
          }}
        />
        <FormatDropdown
          value={format}
          onChange={(f) => {
            setFormat(f);
            setErrorMessage(null);
          }}
        />
      </div>

      {errorMessage !== null && (
        <section className={styles.errorCallout} role="alert" data-testid="scratch-error">
          <p className={styles.errorTitle}>Failed to create deck:</p>
          <p className={styles.errorBody}>{errorMessage}</p>
        </section>
      )}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting}
        data-testid="start-building-btn"
      >
        {isSubmitting ? 'Creating…' : 'Start building'}
      </button>
    </div>
  );
}

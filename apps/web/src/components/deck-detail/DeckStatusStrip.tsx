import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUseSuggestions } from '../../api/replacements';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { Button } from '../ui/Button/Button';
import type { IDeckSummary, TStripKind } from './deckDetailModel';
import styles from './DeckStatusStrip.module.css';

export const MISSING_PANEL_ID = 'deck-missing-panel';

interface IDeckStatusStripProps {
  readonly deckId: number;
  readonly summary: IDeckSummary;
  readonly fabraryUlid: string | null;
  readonly offFormat?: string | null;
}

const TONE_CLASS: Readonly<Record<TStripKind, string>> = {
  complete: styles.toneComplete ?? '',
  suggestions: styles.toneSolvable ?? '',
  incomplete: styles.toneIncomplete ?? '',
};

function useStripMessage(summary: IDeckSummary, offFormat: string | null): string {
  const { t } = useTranslation();
  if (summary.kind === 'complete') {
    return offFormat ? t('deckDetail.stripCompleteOffFormat', { format: offFormat }) : t('deckDetail.stripComplete');
  }
  const gap = `${t('deckDetail.stripMissingCards', { count: summary.missingCards })}.`;
  if (summary.kind === 'incomplete') return gap;
  return `${gap} ${t('deckDetail.stripCoverable', { count: summary.suggestionCount })}`;
}

function UseSuggestionsButton({ deckId, count }: { readonly deckId: number; readonly count: number }): React.ReactElement {
  const { t } = useTranslation();
  const useSuggestions = useUseSuggestions(deckId);
  const [error, setError] = useState<string | null>(null);

  function handleUse(): void {
    setError(null);
    useSuggestions.mutate(undefined, { onError: (failure) => setError(localizeApiError(failure, t)) });
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={handleUse}
        disabled={useSuggestions.isPending}
        data-testid="strip-use-suggestions"
      >
        {t('deckDetail.useSuggestions', { count })}
      </Button>
      {error !== null && (
        <p role="alert" className={styles.error} data-testid="strip-use-error">
          {error}
        </p>
      )}
    </>
  );
}

export function DeckStatusStrip({
  deckId,
  summary,
  fabraryUlid,
  offFormat = null,
}: IDeckStatusStripProps): React.ReactElement {
  const { t } = useTranslation();
  const message = useStripMessage(summary, offFormat);
  const showUse = summary.kind === 'suggestions';
  const showShoppingLink = summary.kind !== 'complete' && summary.missingCards > 0;
  const showFabrary = summary.kind !== 'complete' && fabraryUlid !== null;
  const tone = summary.kind === 'complete' && offFormat ? TONE_CLASS.incomplete : TONE_CLASS[summary.kind];
  const stripClass = [styles.strip, tone].join(' ');

  return (
    <section
      className={stripClass}
      aria-label={t('deckDetail.stripAria')}
      data-testid="deck-status-strip"
      data-kind={summary.kind}
    >
      <p className={styles.message} data-testid="deck-status-strip-message">
        {message}
      </p>
      {(showUse || showShoppingLink || showFabrary) && (
        <div className={styles.actions}>
          {showUse && <UseSuggestionsButton deckId={deckId} count={summary.suggestionCount} />}
          {showShoppingLink && (
            <a href={`#${MISSING_PANEL_ID}`} className={styles.action} data-testid="strip-view-shopping">
              {t('deckDetail.seeShopping')}
            </a>
          )}
          {showFabrary && (
            <a
              href={`https://fabrary.net/decks/${fabraryUlid}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fabrary}
              data-testid="deck-fabrary-link"
              aria-label={t('decks.viewOnFabraryAria')}
            >
              {t('decks.viewOnFabraryLink')}
            </a>
          )}
        </div>
      )}
    </section>
  );
}

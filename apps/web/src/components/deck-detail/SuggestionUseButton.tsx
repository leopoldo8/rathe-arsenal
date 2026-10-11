import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IBreakdownEntry, ISubstitutedEntry } from '../../api/deck-detail';
import { usePickReplacement } from '../../api/replacements';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { withPitch } from './recommendations/card-naming';
import styles from './MissingPanel.module.css';

interface ISuggestionUseButtonProps {
  readonly deckId: number;
  readonly entry: IBreakdownEntry;
  readonly suggestion: ISubstitutedEntry;
}

/** "Usar" on a missing row: picks the collection's suggestion in place of the missing copies. */
export function SuggestionUseButton({ deckId, entry, suggestion }: ISuggestionUseButtonProps): React.ReactElement {
  const { t } = useTranslation();
  const pick = usePickReplacement(deckId);
  const [error, setError] = useState<string | null>(null);
  const substitute = suggestion.match.substitute;

  function handleUse(): void {
    setError(null);
    pick.mutate(
      {
        originalCardIdentifier: entry.cardIdentifier,
        slot: entry.slot,
        replacementCardIdentifier: substitute.cardIdentifier,
        pickedFrom: 'suggested',
      },
      { onError: (failure) => setError(localizeApiError(failure, t)) },
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.use}
        aria-label={t('deckDetail.useSuggestionAria', {
          substitute: withPitch(substitute.name, substitute.pitch, t),
          name: entry.name,
        })}
        disabled={pick.isPending}
        onClick={handleUse}
      >
        {t('deckDetail.useSuggestion')}
      </button>
      {error !== null && (
        <span role="alert" className={styles.useError} data-testid="missing-row-use-error">
          {error}
        </span>
      )}
    </>
  );
}

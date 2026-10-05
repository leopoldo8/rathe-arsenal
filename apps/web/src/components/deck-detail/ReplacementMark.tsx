import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResolveReplacement, type IDeckReplacement, type TResolveAction } from '../../api/replacements';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { humanizeCardIdentifier } from '../../utils/humanize-card-identifier';
import styles from './ReplacementMark.module.css';

/** The "in place of" text for a replacement; shared by the deck list and the missing panel. */
export function ReplacementMark({ replacement }: { readonly replacement: IDeckReplacement }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <span className={styles.mark} data-testid="replacement-mark">
      {t('alternatives.inPlaceOf', { name: humanizeCardIdentifier(replacement.originalCardIdentifier) })}
    </span>
  );
}

/**
 * Undo for an active replacement, plus the keep-or-go-back prompt once the
 * collection covers the original again. Going back sends the same revert as Undo.
 */
export function ReplacementControls({
  deckId,
  replacement,
}: {
  readonly deckId: number;
  readonly replacement: IDeckReplacement;
}): React.ReactElement {
  const { t } = useTranslation();
  const resolve = useResolveReplacement(deckId);
  const [error, setError] = useState<string | null>(null);
  const originalName = humanizeCardIdentifier(replacement.originalCardIdentifier);

  function send(action: TResolveAction): void {
    setError(null);
    resolve.mutate({ id: replacement.id, action }, { onError: (failure) => setError(localizeApiError(failure, t)) });
  }

  return (
    <div className={styles.controls} data-testid="replacement-controls">
      <ReplacementMark replacement={replacement} />
      {replacement.originalOwned ? (
        <span className={styles.prompt} data-testid="replacement-prompt">
          <span>{t('alternatives.originalOwned')}</span>
          <button
            type="button"
            className={styles.button}
            disabled={resolve.isPending}
            aria-label={t('alternatives.keepAria', { name: originalName })}
            onClick={() => send('keep')}
          >
            {t('alternatives.keep')}
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={resolve.isPending}
            aria-label={t('alternatives.goBackAria', { name: originalName })}
            onClick={() => send('revert')}
          >
            {t('alternatives.goBack')}
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={styles.button}
          disabled={resolve.isPending}
          aria-label={t('alternatives.undoAria', { name: originalName })}
          onClick={() => send('revert')}
        >
          {t('alternatives.undo')}
        </button>
      )}
      {error !== null && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IPriceSuggestion } from '../../api/lists';
import { formatBrlWhole, formatSnapshotDate } from './listsModel';
import styles from './ListEditor.module.css';

interface ISuggestionBlockProps {
  readonly suggestion: IPriceSuggestion | null;
  readonly busy: boolean;
  readonly onUse: () => void;
}

export function SuggestionBlock({ suggestion, busy, onUse }: ISuggestionBlockProps): React.ReactElement {
  const { t } = useTranslation();
  if (suggestion === null) {
    return <p className={styles.suggestionNone} data-testid="suggestion-none">{t('lists.pricing.none')}</p>;
  }
  return (
    <div className={styles.suggestion} data-testid="suggestion">
      <div className={styles.suggestionText}>
        <span className={styles.suggestionPrice}>{t('lists.pricing.suggestion', { price: formatBrlWhole(suggestion.cents) })}</span>
        <span className={styles.suggestionSource}>
          {t('lists.pricing.market', { date: formatSnapshotDate(suggestion.fetchedAt) })}
          {suggestion.approximate && ` · ${t('lists.pricing.approximate')}`}
        </span>
      </div>
      <button type="button" className={styles.suggestionUse} disabled={busy} onClick={onUse}>
        {t('lists.pricing.useOne')}
      </button>
    </div>
  );
}

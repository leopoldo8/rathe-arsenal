import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplySuggestionsMutation, usePatchListMutation, type ICardList } from '../../api/lists';
import { parseMultiplier } from './listsModel';
import styles from './ListEditor.module.css';

/** Multiplier of the sell list ("7x") and the button that writes every suggestion into the prices. */
export function ListPricing({ list }: { readonly list: ICardList }): React.ReactElement {
  const { t } = useTranslation();
  const patch = usePatchListMutation(list.id);
  const applyAll = useApplySuggestionsMutation(list.id);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const hasSuggestions = list.lines.some((line) => line.suggestion !== null && !line.sold);

  function commit(): void {
    if (draft === null) return;
    const parsed = parseMultiplier(draft);
    if (!parsed.valid) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    if (parsed.value !== list.priceMultiplier) patch.mutate({ priceMultiplier: parsed.value });
  }

  return (
    <div className={styles.pricing}>
      <label className={styles.multiplier}>
        <span className={styles.barSmall}>{t('lists.pricing.multiplierLabel')}</span>
        <span className={styles.multiplierField} data-invalid={invalid || undefined}>
          <input
            className={styles.multiplierInput}
            type="text"
            inputMode="decimal"
            aria-label={t('lists.pricing.multiplierLabel')}
            aria-invalid={invalid || undefined}
            value={draft ?? (list.priceMultiplier === null ? '' : String(list.priceMultiplier))}
            onFocus={() => setDraft(list.priceMultiplier === null ? '' : String(list.priceMultiplier))}
            onChange={(event) => {
              setInvalid(false);
              setDraft(event.currentTarget.value);
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span aria-hidden="true">x</span>
        </span>
      </label>
      {invalid && <span className={styles.fieldError} role="alert">{t('lists.pricing.multiplierInvalid')}</span>}
      <button
        type="button"
        className={styles.useAll}
        disabled={!hasSuggestions || applyAll.isPending}
        onClick={() => applyAll.mutate(undefined)}
      >
        {t('lists.pricing.useAll')}
      </button>
    </div>
  );
}

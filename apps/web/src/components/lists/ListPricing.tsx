import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplySuggestionsMutation, usePatchListMutation, type ICardList } from '../../api/lists';
import { linesToFill, parseMultiplier } from './listsModel';
import styles from './ListEditor.module.css';

/** The sell list's TCGPlayer rate ("x7") and the button that fills every card without a price from the suggestion. */
export function ListPricing({ list }: { readonly list: ICardList }): React.ReactElement {
  const { t } = useTranslation();
  const patch = usePatchListMutation(list.id);
  const fill = useApplySuggestionsMutation(list.id);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const toFill = linesToFill(list.lines).length;

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
        <span className={styles.barSmall}>{t('lists.pricing.rateLabel')}</span>
        <span className={styles.multiplierField} data-invalid={invalid || undefined}>
          <span aria-hidden="true">x</span>
          <input
            className={styles.multiplierInput}
            type="text"
            inputMode="decimal"
            aria-label={t('lists.pricing.rateLabel')}
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
        </span>
      </label>
      {invalid && <span className={styles.fieldError} role="alert">{t('lists.pricing.multiplierInvalid')}</span>}
      {toFill > 0 && (
        <button type="button" className={styles.useAll} disabled={fill.isPending} onClick={() => fill.mutate(undefined)}>
          {t('lists.pricing.fillEmpty', { count: toFill })}
        </button>
      )}
    </div>
  );
}

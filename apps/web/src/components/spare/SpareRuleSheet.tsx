import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SPARE_RULES, useSetSpareRuleMutation, type TSpareCounts, type TSpareRule } from '../../api/spare';
import { plural } from './spareModel';
import styles from './SpareRuleSheet.module.css';

interface ISpareRuleSheetProps {
  /** Every spare copy under each rule, so each option shows its own result. */
  readonly counts: TSpareCounts;
  /** The stored rule, checked when the player came to change it; null the first time, with nothing checked. */
  readonly initialRule: TSpareRule | null;
  /** Both absent when the question sits inside another page, which has its own way back. */
  readonly backLabel?: string;
  readonly onBack?: () => void;
  readonly onSaved?: (rule: TSpareRule) => void;
  /** The group page and the settings ask the same question under their own heading. */
  readonly headingKey?: string;
  /** Inside another page the heading is a second-level one: the page already has its `h1`. */
  readonly embedded?: boolean;
}

const OPTION_KEYS: Readonly<Record<TSpareRule, { readonly label: string; readonly example: string }>> = {
  within_format: { label: 'spare.ruleWithinFormat', example: 'spare.ruleWithinFormatExample' },
  any_deck: { label: 'spare.ruleAnyDeck', example: 'spare.ruleAnyDeckExample' },
  per_deck: { label: 'spare.rulePerDeck', example: 'spare.rulePerDeckExample' },
};

/** "Você passa cartas de um deck para outro?": three options with their count, nothing chosen the first time. */
export function SpareRuleSheet({ counts, initialRule, backLabel, onBack, onSaved, headingKey = 'spare.ruleHeading', embedded = false }: ISpareRuleSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<TSpareRule | null>(initialRule);
  const save = useSetSpareRuleMutation();

  function handleContinue(): void {
    if (picked === null || save.isPending) return;
    save.mutate(picked, { onSuccess: () => onSaved?.(picked) });
  }

  return (
    <section className={styles.sheet} data-testid="spare-rule-sheet">
      {backLabel !== undefined && onBack !== undefined && (
        <button type="button" className={styles.back} onClick={onBack}>
          {backLabel}
        </button>
      )}
      {embedded ? <h2 className={styles.heading}>{t(headingKey)}</h2> : <h1 className={styles.heading}>{t(headingKey)}</h1>}
      <p id="spare-rule-question" className={styles.question}>
        {t('spare.ruleQuestion')}
      </p>
      <div role="radiogroup" aria-labelledby="spare-rule-question" className={styles.options}>
        {SPARE_RULES.map((rule) => (
          <label key={rule} className={picked === rule ? `${styles.option} ${styles.optionPicked}` : styles.option}>
            <input type="radio" name="spare-rule" className={styles.radio} value={rule} checked={picked === rule} onChange={() => setPicked(rule)} />
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>{t(OPTION_KEYS[rule].label)}</span>
              <span className={styles.example}>{t(OPTION_KEYS[rule].example)}</span>
              <span className={styles.count}>{plural(t, 'spare.ruleCount', counts[rule])}</span>
            </span>
          </label>
        ))}
      </div>
      <p className={styles.note}>{t('spare.ruleNote')}</p>
      {save.isError && (
        <p role="alert" className={styles.error}>
          {t('spare.ruleSaveFailed')}
        </p>
      )}
      <button type="button" className={styles.continue} disabled={picked === null || save.isPending} onClick={handleContinue}>
        {save.isPending ? t('spare.ruleSaving') : t('spare.ruleContinue')}
      </button>
    </section>
  );
}

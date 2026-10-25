import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FabraryFound.module.css';

interface IFabraryOwnershipProps {
  /** `null` until the player answers: neither option is selected by default. */
  readonly value: boolean | null;
  readonly onChange: (ownsCards: boolean) => void;
  readonly name: string;
}

/** "Essas cartas são suas?": the answer decides whether the deck's cards enter the collection. */
export function FabraryOwnership({ value, onChange, name }: IFabraryOwnershipProps): React.ReactElement {
  const { t } = useTranslation();
  const options = [
    { answer: true, label: t('fabraryImport.yes') },
    { answer: false, label: t('fabraryImport.no') },
  ] as const;
  return (
    <fieldset className={styles.question}>
      <legend className={styles.legend}>{t('fabraryImport.question')}</legend>
      {options.map(({ answer, label }) => (
        <label key={String(answer)} className={styles.option} data-selected={value === answer}>
          <input
            type="radio"
            name={name}
            className={styles.radio}
            checked={value === answer}
            onChange={() => onChange(answer)}
          />
          <span>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WhatsappNumberField.module.css';

interface IWhatsappNumberFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | null;
}

/** Number input with the fixed "+55" prefix; the value is what the person types after it. */
export function WhatsappNumberField({ label, value, onChange, error }: IWhatsappNumberFieldProps): React.ReactElement {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = useId();
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={error === null ? styles.box : `${styles.box} ${styles.boxInvalid}`}>
        <span className={styles.prefix} aria-hidden="true">
          {t('sharing.contact.countryPrefix')}
        </span>
        <input
          id={inputId}
          className={styles.input}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="53 99999-0000"
          value={value}
          aria-invalid={error === null ? undefined : 'true'}
          aria-describedby={error === null ? undefined : errorId}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error !== null && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

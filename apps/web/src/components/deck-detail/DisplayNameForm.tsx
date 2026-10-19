import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
} from '../../lib/display-name';
import styles from './DisplayNameForm.module.css';

interface IDisplayNameFormProps {
  readonly initialName: string;
  readonly saving: boolean;
  readonly error: string | null;
  readonly submitLabel: string;
  readonly onSubmit: (name: string) => void;
  readonly onCancel: () => void;
}

/** Asks for the name shown on shared links, before the first link is made. */
export function DisplayNameForm({
  initialName,
  saving,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: IDisplayNameFormProps): React.ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const inputId = useId();
  const valid = isValidDisplayName(name);

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !saving) onSubmit(name.trim());
      }}
    >
      <label className={styles.label} htmlFor={inputId}>
        {t('sharing.displayName.label')}
      </label>
      <div className={styles.inputWrap}>
        <input
          id={inputId}
          className={styles.input}
          type="text"
          value={name}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="nickname"
          // The name step is the only thing on screen when it appears, so it takes focus.
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
        <span className={styles.counter} aria-hidden="true">
          {t('sharing.displayName.count', { count: name.length })}
        </span>
      </div>
      <p className={styles.hint}>{t('sharing.displayName.hint')}</p>
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={onCancel}>
          {t('sharing.displayName.cancel')}
        </button>
        <button
          type="submit"
          className={styles.primary}
          aria-disabled={!valid || saving ? 'true' : undefined}
          aria-busy={saving ? 'true' : undefined}
        >
          {saving ? t('sharing.displayName.saving') : submitLabel}
        </button>
      </div>
    </form>
  );
}

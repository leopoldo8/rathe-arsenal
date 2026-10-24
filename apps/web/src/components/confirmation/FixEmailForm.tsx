import React, { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { isPlausibleEmail } from '../../lib/is-plausible-email';
import styles from '../auth/AccountSteps.module.css';

interface IFixEmailFormProps {
  readonly initialEmail: string;
  /** Called with the corrected address once the account moved to it and the new confirmation went out. */
  readonly onFixed: (email: string) => void;
}

/** "Errei o e-mail": the field to correct the address of an account that has not confirmed it yet. */
export function FixEmailForm({ initialEmail, onFixed }: IFixEmailFormProps): React.ReactElement {
  const { t } = useTranslation();
  const { changeEmail } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [typo, setTypo] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setServerError('');
    const address = email.trim().toLowerCase();
    if (!isPlausibleEmail(address)) {
      setTypo(true);
      inputRef.current?.focus();
      return;
    }
    setTypo(false);
    setSubmitting(true);
    try {
      await changeEmail(address);
      onFixed(address);
    } catch (err) {
      setServerError(localizeAuthError(err, t));
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor="fix-email">
        {t('account.emailLabel')}
      </label>
      <input
        id="fix-email"
        ref={inputRef}
        className={styles.input}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={typo ? 'true' : undefined}
        aria-describedby={typo ? 'fix-email-error' : undefined}
      />
      {typo && (
        <p id="fix-email-error" className={styles.fieldError}>
          {t('account.emailTypo')}
        </p>
      )}
      {serverError !== '' && (
        <p className={styles.fieldError} role="alert">
          {serverError}
        </p>
      )}
      <button
        type="submit"
        className={styles.primaryBtn}
        aria-disabled={submitting ? 'true' : undefined}
        aria-busy={submitting ? 'true' : undefined}
      >
        {submitting ? t('account.continuing') : t('account.continueBtn')}
      </button>
    </form>
  );
}

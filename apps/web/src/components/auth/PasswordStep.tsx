import React, { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFetchError } from '../../lib/auth-fetch';
import { useAuth } from '../../auth/useAuth';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { lastSignInUsedPassword, rememberSignIn } from '../../lib/remembered-account';
import styles from './AccountSteps.module.css';

const MIN_PASSWORD_LENGTH = 10;

interface IPasswordStepProps {
  readonly email: string;
  readonly onChangeEmail: () => void;
  readonly onUseCode: () => void;
  readonly onSignedIn: () => void;
}

export function PasswordStep({ email, onChangeEmail, onUseCode, onSignedIn }: IPasswordStepProps): React.ReactElement {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [wrongPassword, setWrongPassword] = useState(false);
  const [tooShort, setTooShort] = useState(false);
  const [tooManyTries, setTooManyTries] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting || password === '') return;
    setError('');
    setWrongPassword(false);
    setTooManyTries(false);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setTooShort(true);
      inputRef.current?.focus();
      return;
    }
    setTooShort(false);
    setSubmitting(true);
    try {
      await signIn(email, password);
      rememberSignIn(email, 'password');
      onSignedIn();
    } catch (err) {
      if (err instanceof AuthFetchError && err.status === 401) setWrongPassword(true);
      else {
        setError(localizeAuthError(err, t));
        setTooManyTries(err instanceof AuthFetchError && err.status === 429);
      }
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <span className={styles.label}>{t('account.emailFieldLabel')}</span>
      <div className={styles.emailBox}>
        <p className={styles.emailText}>{email}</p>
      </div>
      <button type="button" className={styles.linkBtn} onClick={onChangeEmail}>
        {t('account.notYou')}
      </button>
      {lastSignInUsedPassword(email) && <p className={styles.note}>{t('account.lastTimePassword')}</p>}

      <label className={styles.label} htmlFor="sign-in-password">
        {t('account.passwordLabel')}
      </label>
      <input
        id="sign-in-password"
        ref={inputRef}
        className={styles.input}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={wrongPassword || tooShort ? 'true' : undefined}
        aria-describedby={tooShort ? 'sign-in-password-error' : undefined}
      />
      {tooShort && (
        <p id="sign-in-password-error" className={styles.fieldError}>
          {t('apiErrors.PASSWORD_TOO_SHORT')}
        </p>
      )}
      {wrongPassword && (
        <div className={styles.inlineRow} role="alert">
          <p className={styles.fieldError}>{t('account.wrongPassword')}</p>
          <button type="button" className={styles.linkBtn} onClick={onUseCode}>
            {t('account.useCodeShort')}
          </button>
        </div>
      )}
      {error !== '' && (
        <div className={styles.inlineRow} role="alert">
          <p className={styles.fieldError}>{error}</p>
          {tooManyTries && (
            <button type="button" className={styles.linkBtn} onClick={onUseCode}>
              {t('account.tooManyUseCode')}
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        className={styles.primaryBtn}
        aria-disabled={submitting ? 'true' : undefined}
        aria-busy={submitting ? 'true' : undefined}
      >
        {submitting ? t('account.signingIn') : t('account.signInBtn')}
      </button>
      <button type="button" className={styles.secondaryBtn} onClick={onUseCode}>
        {t('account.useCode')}
      </button>
      <p className={styles.note}>{t('account.forgotPassword')}</p>
    </form>
  );
}

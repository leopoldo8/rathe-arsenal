import React, { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { AuthFetchError } from '../../lib/auth-fetch';
import { requestPasswordCode, setAccountPassword, type ICodeRequest } from '../../lib/account-api';
import { PasswordCodeStep, type TCodeProblem } from './PasswordCodeStep';
import styles from './AccountSetting.module.css';

const MIN_PASSWORD_LENGTH = 10;

type TStage = 'row' | 'code' | 'password';

/** "Conta" panel of Settings: the e-mail, and creating or changing the password. A password cannot be removed (AC 261). */
export function AccountSetting({ className }: { readonly className?: string | undefined }): React.ReactElement {
  const { t } = useTranslation();
  const { user, setHasPassword } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPassword = user?.hasPassword === true;
  const [stage, setStage] = useState<TStage>('row');
  const [sent, setSent] = useState<ICodeRequest | null>(null);
  const [code, setCode] = useState('');
  const [codeProblem, setCodeProblem] = useState<TCodeProblem | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [password, setPassword] = useState('');
  const [tooShort, setTooShort] = useState(false);
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  function close(): void {
    setStage('row');
    setSent(null);
    setCode('');
    setCodeProblem(null);
    setPassword('');
    setTooShort(false);
    setServerError('');
  }

  async function askCode(): Promise<void> {
    if (requesting) return;
    setServerError('');
    setCodeProblem(null);
    setRequesting(true);
    try {
      setSent(await requestPasswordCode());
      setStage('code');
    } catch (err) {
      setServerError(localizeAuthError(err, t));
    } finally {
      setRequesting(false);
    }
  }

  function handleFilled(digits: string): void {
    setCode(digits);
    setServerError('');
    setStage('password');
  }

  /** A refused code sends the player back to the digits; any other failure stays on the form. */
  function backToCode(err: unknown): boolean {
    if (!(err instanceof AuthFetchError)) return false;
    if (err.status === 400 && err.code === 'INVALID_CODE') setCodeProblem('wrong');
    else if (err.status === 410) setCodeProblem('expired');
    else if (err.status !== 429) return false;
    else setServerError(localizeAuthError(err, t));
    setPassword('');
    setStage('code');
    return true;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;
    setServerError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setTooShort(true);
      inputRef.current?.focus();
      return;
    }
    setTooShort(false);
    setSaving(true);
    try {
      await setAccountPassword(code, password);
      setHasPassword(true);
      close();
    } catch (err) {
      if (!backToCode(err)) setServerError(localizeAuthError(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={className} aria-labelledby="section-conta">
      <h2 id="section-conta" className={styles.heading}>
        {t('settings.accountHeading')}
      </h2>
      <div className={styles.field}>
        <span className={styles.label}>{t('settings.emailAddress')}</span>
        <span className={styles.value}>{user?.email ?? ''}</span>
      </div>

      <div className={styles.passwordRow}>
        <span className={styles.passwordState}>{t(hasPassword ? 'settings.passwordHave' : 'settings.passwordNone')}</span>
        {stage === 'row' && (
          <button
            type="button"
            className={styles.action}
            aria-disabled={requesting ? 'true' : undefined}
            aria-busy={requesting ? 'true' : undefined}
            onClick={() => void askCode()}
          >
            {t(hasPassword ? 'settings.changePassword' : 'settings.createPassword')}
          </button>
        )}
      </div>

      {stage === 'row' && serverError !== '' && (
        <p className={styles.error} role="alert">
          {serverError}
        </p>
      )}

      {stage === 'code' && sent !== null && (
        <PasswordCodeStep
          email={user?.email ?? ''}
          sent={sent}
          problem={codeProblem}
          error={serverError}
          resending={requesting}
          onFilled={handleFilled}
          onResend={() => void askCode()}
          onCancel={close}
        />
      )}

      {stage === 'password' && (
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
          <label className={styles.label} htmlFor="settings-new-password">
            {t('settings.newPasswordLabel')}
          </label>
          <input
            id="settings-new-password"
            ref={inputRef}
            className={styles.input}
            type="password"
            autoComplete="new-password"
            // The form opens from the button the player just pressed, so it takes focus.
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={tooShort ? 'true' : undefined}
            aria-describedby="settings-new-password-note"
          />
          <p id="settings-new-password-note" className={tooShort ? styles.error : styles.note}>
            {tooShort ? t('apiErrors.PASSWORD_TOO_SHORT') : t('account.passwordRule')}
          </p>
          {serverError !== '' && (
            <p className={styles.error} role="alert">
              {serverError}
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} onClick={close}>
              {t('settings.passwordCancel')}
            </button>
            <button
              type="submit"
              className={styles.save}
              aria-disabled={saving ? 'true' : undefined}
              aria-busy={saving ? 'true' : undefined}
            >
              {t('settings.savePassword')}
            </button>
          </div>
        </form>
      )}

      <p className={styles.note}>{t('settings.passwordCodeNote')}</p>
    </section>
  );
}

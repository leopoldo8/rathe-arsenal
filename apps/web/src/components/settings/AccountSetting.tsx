import React, { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { setAccountPassword } from '../../lib/account-api';
import styles from './AccountSetting.module.css';

const MIN_PASSWORD_LENGTH = 10;

/** "Conta" panel of Settings: the e-mail, and creating or changing the password. A password cannot be removed (AC 261). */
export function AccountSetting({ className }: { readonly className?: string | undefined }): React.ReactElement {
  const { t } = useTranslation();
  const { user, setHasPassword } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPassword = user?.hasPassword === true;
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [tooShort, setTooShort] = useState(false);
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  function close(): void {
    setEditing(false);
    setPassword('');
    setTooShort(false);
    setServerError('');
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
      await setAccountPassword(password);
      setHasPassword(true);
      close();
    } catch (err) {
      setServerError(localizeAuthError(err, t));
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
        {!editing && (
          <button type="button" className={styles.action} onClick={() => setEditing(true)}>
            {t(hasPassword ? 'settings.changePassword' : 'settings.createPassword')}
          </button>
        )}
      </div>

      {editing && (
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

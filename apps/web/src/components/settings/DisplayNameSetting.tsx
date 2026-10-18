import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patchDisplayName } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { DISPLAY_NAME_MAX_LENGTH, isValidDisplayName } from '../../lib/display-name';
import { AuthFetchError } from '../../lib/auth-fetch';
import styles from './DisplayNameSetting.module.css';

type TStatus = 'idle' | 'saving' | 'saved' | 'invalid' | 'failed';

/** Settings field for the name shown on shared decks (PATCH /users/me/display-name). */
export function DisplayNameSetting(): React.ReactElement {
  const { t } = useTranslation();
  const { token, user, setDisplayName } = useAuth();
  const [name, setName] = useState(user?.displayName ?? '');
  const [status, setStatus] = useState<TStatus>('idle');
  const inputId = useId();
  const valid = isValidDisplayName(name);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!valid || status === 'saving') return;
    setStatus('saving');
    try {
      const saved = await patchDisplayName(name.trim(), token);
      setDisplayName(saved.displayName);
      setName(saved.displayName);
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof AuthFetchError && error.status === 400 ? 'invalid' : 'failed');
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <label className={styles.label} htmlFor={inputId}>
        {t('sharing.displayName.label')}
      </label>
      <div className={styles.row}>
        <input
          id={inputId}
          className={styles.input}
          type="text"
          value={name}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="nickname"
          onChange={(event) => {
            setName(event.target.value);
            setStatus('idle');
          }}
        />
        <button
          type="submit"
          className={styles.save}
          aria-disabled={!valid || status === 'saving' ? 'true' : undefined}
          aria-busy={status === 'saving' ? 'true' : undefined}
        >
          {status === 'saving' ? t('sharing.displayName.saving') : t('sharing.displayName.save')}
        </button>
      </div>
      <p className={styles.hint}>{t('sharing.displayName.settingsHint')}</p>
      <p className={status === 'saved' ? styles.ok : styles.error} role={status === 'saved' ? 'status' : 'alert'}>
        {status === 'saved' && t('sharing.displayName.saved')}
        {status === 'invalid' && t('sharing.displayName.invalid')}
        {status === 'failed' && t('sharing.displayName.saveFailed')}
      </p>
    </form>
  );
}

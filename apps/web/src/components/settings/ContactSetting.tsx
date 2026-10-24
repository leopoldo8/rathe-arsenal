import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patchContact } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { AuthFetchError } from '../../lib/auth-fetch';
import { formatNumberForField, isPlausibleWhatsappNumber } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { WhatsappNumberField } from '../contact/WhatsappNumberField';
import styles from './ContactSetting.module.css';

type TStatus = 'idle' | 'saving' | 'saved' | 'removed' | 'failed';

/** "Contato" panel of Settings: the optional WhatsApp number shown on shared links (PATCH /users/me/contact). */
export function ContactSetting({ className }: { readonly className?: string | undefined }): React.ReactElement {
  const { t } = useTranslation();
  const { user, setWhatsappNumber } = useAuth();
  const saved = user?.whatsappNumber ?? null;
  const [value, setValue] = useState(formatNumberForField(saved));
  const [status, setStatus] = useState<TStatus>('idle');
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function send(next: string | null): Promise<void> {
    setStatus('saving');
    setFieldError(null);
    try {
      const result = await patchContact(next);
      setWhatsappNumber(result.whatsappNumber);
      setValue(formatNumberForField(result.whatsappNumber));
      setStatus(next === null ? 'removed' : 'saved');
    } catch (error) {
      if (error instanceof AuthFetchError && error.status === 400) {
        setFieldError(t('sharing.contact.invalid'));
        setStatus('idle');
        return;
      }
      setStatus('failed');
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (status === 'saving') return;
    if (!isPlausibleWhatsappNumber(value)) {
      setFieldError(t('sharing.contact.invalid'));
      return;
    }
    void send(value);
  }

  return (
    <section className={className ?? styles.section} aria-labelledby="section-contact">
      <h2 id="section-contact" className={styles.heading}>
        <span className={styles.icon}>
          <WhatsappGlyph />
        </span>
        {t('sharing.contact.settingsTitle')}
      </h2>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <WhatsappNumberField
          label={t('sharing.contact.settingsLabel')}
          value={value}
          onChange={(next) => {
            setValue(next);
            setFieldError(null);
            setStatus('idle');
          }}
          error={fieldError}
        />
        <p className={styles.hint}>{t('sharing.contact.settingsHint')}</p>
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.save}
            aria-busy={status === 'saving' ? 'true' : undefined}
            aria-disabled={status === 'saving' ? 'true' : undefined}
          >
            {status === 'saving' ? t('sharing.contact.saving') : t('sharing.contact.save')}
          </button>
          {saved !== null && (
            <button type="button" className={styles.remove} onClick={() => void send(null)}>
              {t('sharing.contact.remove')}
            </button>
          )}
        </div>
        <p className={status === 'failed' ? styles.error : styles.ok} role={status === 'failed' ? 'alert' : 'status'}>
          {status === 'saved' && t('sharing.contact.saved')}
          {status === 'removed' && t('sharing.contact.removed')}
          {status === 'failed' && t('sharing.contact.saveFailed')}
        </p>
      </form>
    </section>
  );
}

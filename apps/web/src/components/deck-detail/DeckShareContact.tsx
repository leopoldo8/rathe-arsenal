import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patchContact, useSetDeckShareContactMutation } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { AuthFetchError } from '../../lib/auth-fetch';
import { formatNumberForDisplay, isPlausibleWhatsappNumber } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { WhatsappNumberField } from '../contact/WhatsappNumberField';
import { WhatsappPreview } from '../contact/WhatsappPreview';
import styles from './DeckShareContact.module.css';

interface IDeckShareContactProps {
  readonly deckId: number;
  readonly deckName: string;
  /** This link's "show my WhatsApp" setting, as the API last reported it. */
  readonly showContact: boolean;
}

/**
 * "Show my WhatsApp" row of the share card. The switch is per link; the number
 * lives in the profile, so without one the card asks for it inline and turns
 * the switch on once it is saved.
 */
export function DeckShareContact({ deckId, deckName, showContact }: IDeckShareContactProps): React.ReactElement {
  const { t } = useTranslation();
  const { token, user, setWhatsappNumber } = useAuth();
  const setContact = useSetDeckShareContactMutation(deckId);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const savedNumber = user?.whatsappNumber ?? null;
  const hasNumber = savedNumber !== null;
  const isOn = hasNumber && showContact;
  const sharerName = user?.displayName ?? t('sharing.contact.previewFallbackName');

  function toggle(next: boolean): void {
    setMessage(null);
    setContact.mutate(next, { onError: () => setMessage(t('sharing.contact.toggleFailed')) });
  }

  async function handleSaveAndShow(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;
    if (!isPlausibleWhatsappNumber(draft)) {
      setFieldError(t('sharing.contact.invalid'));
      return;
    }
    setSaving(true);
    setFieldError(null);
    try {
      const saved = await patchContact(draft, token);
      setWhatsappNumber(saved.whatsappNumber);
      setDraft('');
      toggle(true);
    } catch (error) {
      setFieldError(
        error instanceof AuthFetchError && error.status === 400
          ? t('sharing.contact.invalid')
          : t('sharing.contact.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  }

  const statusText = !hasNumber
    ? t('sharing.contact.needNumber')
    : isOn
      ? t('sharing.contact.numberLine', { number: formatNumberForDisplay(savedNumber) })
      : t('sharing.contact.off');

  return (
    <div className={styles.row} data-testid="deck-share-contact">
      <div className={styles.head}>
        <span className={styles.icon}>
          <WhatsappGlyph />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{t('sharing.contact.switchLabel')}</p>
          <p className={styles.sub}>{statusText}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={t('sharing.contact.switchLabel')}
          aria-disabled={!hasNumber || setContact.isPending ? 'true' : undefined}
          className={styles.switch}
          data-on={isOn}
          data-testid="deck-share-contact-switch"
          onClick={() => {
            if (hasNumber && !setContact.isPending) toggle(!showContact);
          }}
        >
          <span className={styles.knob} aria-hidden="true" />
        </button>
      </div>

      {!hasNumber && (
        <form className={styles.form} noValidate onSubmit={(event) => void handleSaveAndShow(event)}>
          <WhatsappNumberField
            label={t('sharing.contact.fieldLabel')}
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setFieldError(null);
            }}
            error={fieldError}
          />
          <button type="submit" className={styles.save} aria-busy={saving ? 'true' : undefined}>
            {saving ? t('sharing.contact.saving') : t('sharing.contact.saveAndShow')}
          </button>
          <p className={styles.note}>{t('sharing.contact.savedNote')}</p>
        </form>
      )}

      {isOn && (
        <WhatsappPreview name={sharerName} message={t('sharing.contact.message', { deck: deckName })} />
      )}

      {message !== null && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

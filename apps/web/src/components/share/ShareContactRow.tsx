import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patchContact } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { AuthFetchError } from '../../lib/auth-fetch';
import { formatNumberForDisplay, isPlausibleWhatsappNumber } from '../../lib/whatsapp';
import { WhatsappGlyph } from '../contact/WhatsappGlyph';
import { WhatsappNumberField } from '../contact/WhatsappNumberField';
import styles from './ShareContactRow.module.css';

interface IShareContactRowProps {
  /** This link's "show my WhatsApp" setting, as the API last reported it. */
  readonly showContact: boolean;
  readonly updating: boolean;
  /** Asks the API to change the link's setting; `onFailed` runs if it could not. */
  readonly onToggle: (next: boolean, onFailed: () => void) => void;
  readonly testId: string;
  /** Lists warn first: without a number the page cannot be answered, so the form leads with that and offers to go on without. */
  readonly warnWithoutNumber?: boolean;
}

/**
 * "Show my WhatsApp" row of the share dialogs. The switch is per link; the
 * number lives in the profile, so without one the row asks for it inline and
 * turns the switch on once it is saved.
 */
export function ShareContactRow({ showContact, updating, onToggle, testId, warnWithoutNumber = false }: IShareContactRowProps): React.ReactElement {
  const { t } = useTranslation();
  const { user, setWhatsappNumber } = useAuth();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);

  const savedNumber = user?.whatsappNumber ?? null;
  const hasNumber = savedNumber !== null;
  const isOn = hasNumber && showContact;

  function toggle(next: boolean): void {
    setMessage(null);
    onToggle(next, () => setMessage(t('sharing.contact.toggleFailed')));
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
      const saved = await patchContact(draft);
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

  const statusText = hasNumber ? t('sharing.contact.numberLine', { number: formatNumberForDisplay(savedNumber) }) : null;

  return (
    <div className={styles.row} data-testid={testId}>
      <div className={styles.head}>
        <span className={styles.icon}>
          <WhatsappGlyph />
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{t('sharing.contact.switchLabel')}</p>
          {statusText !== null && <p className={styles.sub}>{statusText}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={t('sharing.contact.switchLabel')}
          aria-disabled={!hasNumber || updating ? 'true' : undefined}
          className={styles.switch}
          data-on={isOn}
          data-testid={`${testId}-switch`}
          onClick={() => {
            if (hasNumber && !updating) toggle(!showContact);
          }}
        >
          <span className={styles.knob} aria-hidden="true" />
        </button>
      </div>

      {!hasNumber && !(warnWithoutNumber && skipped) && (
        <form className={styles.form} noValidate onSubmit={(event) => void handleSaveAndShow(event)}>
          <WhatsappNumberField
            label={t(warnWithoutNumber ? 'sharing.contact.warnLabel' : 'sharing.contact.fieldLabel')}
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setFieldError(null);
            }}
            error={fieldError}
            {...(warnWithoutNumber ? { placeholder: t('sharing.contact.warnPlaceholder') } : {})}
          />
          {warnWithoutNumber && <p className={styles.warning}>{t('sharing.contact.warnNoNumber')}</p>}
          <button type="submit" className={styles.save} aria-busy={saving ? 'true' : undefined}>
            {saving ? t('sharing.contact.saving') : t('sharing.contact.saveAndShow')}
          </button>
          {warnWithoutNumber && (
            <>
              <p className={styles.note}>{t('sharing.contact.warnSaveHint')}</p>
              <button type="button" className={styles.skip} onClick={() => setSkipped(true)}>
                {t('sharing.contact.shareWithoutContact')}
              </button>
            </>
          )}
        </form>
      )}

      {message !== null && (
        <p className={styles.error} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

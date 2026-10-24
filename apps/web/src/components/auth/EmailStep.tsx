import React, { FormEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { isPlausibleEmail } from '../../lib/is-plausible-email';
import { startAccount, type TStartNext } from '../../lib/account-api';
import { ofOwner } from './owner-phrase';
import type { IShareOrigin } from './ShareOrigin';
import styles from './AccountSteps.module.css';

interface IEmailStepProps {
  readonly initialEmail: string;
  /** True when the visitor arrived from a shared page: the page's card and reason replace the pitch. */
  readonly fromSharedPage: boolean;
  /** The shared page, once looked up; the reason and the way back name it. */
  readonly origin: IShareOrigin | null;
  readonly onResolved: (email: string, next: TStartNext) => void;
  /** Only the field and its button: no pitch, no shared page, no note. For the sheet that opens over a page. */
  readonly compact?: boolean;
}

export function EmailStep({ initialEmail, fromSharedPage, origin, onResolved, compact = false }: IEmailStepProps): React.ReactElement {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [typo, setTypo] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setServerError('');
    const address = email.trim();
    if (!isPlausibleEmail(address)) {
      setTypo(true);
      inputRef.current?.focus();
      return;
    }
    setTypo(false);
    setSubmitting(true);
    try {
      onResolved(address.toLowerCase(), await startAccount(address.toLowerCase()));
    } catch (err) {
      setServerError(localizeAuthError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const owner = origin === null ? '' : ofOwner(t, origin.ownerName);
  const errorId = 'start-email-error';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {compact ? null : fromSharedPage ? (
        origin !== null && (
          <>
            <div className={styles.sharedCard}>
              {origin.imageUrl !== null && <img className={styles.sharedArt} src={origin.imageUrl} alt="" />}
              <p className={styles.sharedName}>{t('account.sharedCardBy', { name: origin.name, owner: origin.ownerName })}</p>
            </div>
            <p className={styles.lead}>
              {origin.reason === 'deck' ? t('account.sharedReasonDeck', { ofOwner: owner }) : t('account.sharedReasonCards')}
            </p>
          </>
        )
      ) : (
        <>
          <p className={styles.lead}>{t('account.headline')}</p>
          <ul className={styles.pitch}>
            {(['pitchLine1', 'pitchLine2', 'pitchLine3'] as const).map((key) => (
              <li key={key} className={styles.pitchLine}>
                <span className={styles.check} aria-hidden="true">
                  ✓
                </span>
                {t(`account.${key}`)}
              </li>
            ))}
          </ul>
        </>
      )}

      <label className={styles.label} htmlFor="start-email">
        {t('account.emailLabel')}
      </label>
      <input
        id="start-email"
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
        aria-describedby={typo ? errorId : undefined}
      />
      {typo && (
        <p id={errorId} className={styles.fieldError}>
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

      {!compact && (
      <p className={styles.note}>
        {typo
          ? t('account.nothingSent')
          : fromSharedPage
            ? origin !== null &&
              t(origin.kind === 'list' ? 'account.sharedBackList' : 'account.sharedBackDeck', { ofOwner: owner })
            : t('account.startNote')}
      </p>
      )}
    </form>
  );
}

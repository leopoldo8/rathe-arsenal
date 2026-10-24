import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { isGmailAddress } from '../../lib/is-gmail-address';
import { ShareDialogHeader } from '../share/ShareDialogHeader';
import shareStyles from '../share/ShareSteps.module.css';
import styles from '../auth/AccountSteps.module.css';
import { FixEmailForm } from './FixEmailForm';
import { useResendConfirmation } from './useResendConfirmation';

interface IConfirmEmailPanelProps {
  readonly onClose: () => void;
}

/** What a share dialog shows instead of its link when the account has not confirmed its e-mail (`r2-share-blocked-phone`). */
export function ConfirmEmailPanel({ onClose }: IConfirmEmailPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { sending, error, resend } = useResendConfirmation();
  const [fixing, setFixing] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const email = user?.email ?? '';

  async function handleResend(): Promise<void> {
    if (await resend()) setSentTo(email);
  }

  return (
    <>
      <ShareDialogHeader title={t('account.confirmSheetTitle')} />
      <div className={shareStyles.body}>
        {fixing ? (
          <FixEmailForm
            initialEmail={email}
            onFixed={(fixed) => {
              setFixing(false);
              setSentTo(fixed);
            }}
          />
        ) : (
          <>
            <p className={styles.lead}>{t('account.confirmSheetBody', { email })}</p>
            <p className={styles.note}>{t(isGmailAddress(email) ? 'account.spamPromotions' : 'account.spam')}</p>
            {sentTo !== null && (
              <p className={shareStyles.status} role="status">
                {t('account.confirmationSent', { email: sentTo })}
              </p>
            )}
            {error !== null && (
              <p className={shareStyles.error} role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className={styles.primaryBtn}
              aria-disabled={sending ? 'true' : undefined}
              onClick={() => void handleResend()}
            >
              {t('account.resendLink')}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setFixing(true)}>
              {t('account.wrongEmail')}
            </button>
            <button type="button" className={`${styles.linkBtn} ${styles.linkBtnCentered}`} onClick={onClose}>
              {t('account.notNow')}
            </button>
          </>
        )}
      </div>
    </>
  );
}

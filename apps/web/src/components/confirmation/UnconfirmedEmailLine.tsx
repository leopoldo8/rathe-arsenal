import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../auth/AuthContext';
import { ShareDialogFrame } from '../share/ShareDialogFrame';
import { ShareDialogHeader } from '../share/ShareDialogHeader';
import shareStyles from '../share/ShareSteps.module.css';
import { useToast } from '../ui/Toast/useToast';
import { FixEmailForm } from './FixEmailForm';
import { useResendConfirmation } from './useResendConfirmation';
import styles from './UnconfirmedEmailLine.module.css';

/** The quiet line of the home while the account's e-mail is unconfirmed (`r3-home-unconfirmed-phone`). */
export function UnconfirmedEmailLine(): React.ReactElement | null {
  const user = useContext(AuthContext)?.user;
  return user?.emailConfirmed === false ? <ConfirmLine email={user.email} /> : null;
}

function ConfirmLine({ email }: { readonly email: string }): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const { error, resend } = useResendConfirmation();
  const [fixing, setFixing] = useState(false);

  async function handleResend(): Promise<void> {
    if (await resend()) show({ kind: 'success', message: t('account.confirmationSent', { email }) });
  }

  return (
    <>
      <p className={styles.line}>
        {t('account.unconfirmedLine', { email })}{' '}
        <button type="button" className={styles.action} onClick={() => void handleResend()}>
          {t('account.resendNow')}
        </button>
        {' · '}
        <button type="button" className={styles.action} onClick={() => setFixing(true)}>
          {t('account.wrongEmail')}
        </button>
      </p>
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ShareDialogFrame open={fixing} onOpenChange={setFixing}>
        <ShareDialogHeader title={t('account.wrongEmail')} />
        <div className={shareStyles.body}>
          <FixEmailForm
            initialEmail={email}
            onFixed={(fixed) => {
              setFixing(false);
              show({ kind: 'success', message: t('account.confirmationSent', { email: fixed }) });
            }}
          />
        </div>
      </ShareDialogFrame>
    </>
  );
}

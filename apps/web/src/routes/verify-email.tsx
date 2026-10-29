import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { localizeAuthError } from '../auth/localize-auth-error';
import { AuthFetchError } from '../lib/auth-fetch';
import type { IEmailConfirmation } from '../lib/account-api';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import { useResendConfirmation } from '../components/confirmation/useResendConfirmation';
import { useToast } from '../components/ui/Toast/useToast';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? '',
  }),
});

type TStatus =
  | { readonly kind: 'verifying' }
  | { readonly kind: 'confirmed'; readonly confirmation: IEmailConfirmation }
  | { readonly kind: 'expired' }
  | { readonly kind: 'failed'; readonly message: string };

export function VerifyEmailPage(): React.ReactElement {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const { user, isLoading, verifyEmail } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const router = useRouter();
  const resend = useResendConfirmation();
  const [status, setStatus] = useState<TStatus>({ kind: 'verifying' });
  const started = useRef(false);

  useEffect(() => {
    // The session is asked for on load, so who is signed in is known only once that settles.
    if (isLoading || started.current) return;
    started.current = true;
    if (!token) {
      setStatus({ kind: 'failed', message: t('auth.verifyNoToken') });
      return;
    }
    verifyEmail(token)
      .then((confirmation) => {
        if (user?.email !== confirmation.email) {
          setStatus({ kind: 'confirmed', confirmation });
          return;
        }
        show({ kind: 'success', message: t('account.confirmedToast') });
        if (confirmation.returnPath !== null) router.history.push(confirmation.returnPath);
        else void navigate({ to: '/home', search: { tag: [] } });
      })
      .catch((err: unknown) => {
        if (err instanceof AuthFetchError && err.status === 410) setStatus({ kind: 'expired' });
        else setStatus({ kind: 'failed', message: localizeAuthError(err, t) });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLoading]);

  async function sendNewOne(): Promise<void> {
    if (user !== null && (await resend.resend())) show({ kind: 'success', message: t('account.confirmationSent', { email: user.email }) });
  }

  if (status.kind === 'failed' || status.kind === 'expired') {
    return (
      <AuthLayout title={t('auth.verifyFailedTitle')} tagline={t('auth.verifyFailedTagline')}>
        <div role="alert" className={styles.errorBox}>
          <p>{status.kind === 'expired' ? t('account.linkExpired') : status.message}</p>
        </div>
        {status.kind === 'expired' && user !== null && (
          <button type="button" className={styles.submitBtn} onClick={() => void sendNewOne()}>
            {t('account.sendNewOne')}
          </button>
        )}
        {status.kind === 'expired' && user === null && (
          <button type="button" className={styles.submitBtn} onClick={() => void navigate({ to: '/entrar' })}>
            {t('account.signInTitle')}
          </button>
        )}
        {resend.error !== null && (
          <div role="alert" className={styles.errorBox}>
            <p>{resend.error}</p>
          </div>
        )}
      </AuthLayout>
    );
  }

  if (status.kind === 'confirmed') {
    const { returnPath, email } = status.confirmation;
    return (
      <AuthLayout title={t('account.confirmedSignedOut')} tagline={t('auth.verifySuccessTagline')}>
        <div className={styles.successBanner} role="status">
          <span>{t('account.confirmedSignedOut')}</span>
        </div>
        <button
          type="button"
          className={styles.submitBtn}
          onClick={() => void navigate({ to: '/entrar', search: { email, ...(returnPath !== null ? { next: returnPath } : {}) } })}
        >
          {t('account.signInTitle')}
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.verifyingTitle')} tagline={t('auth.verifyingTagline')}>
      <div className={styles.statusPending}>
        <div className={styles.statusIcon} aria-hidden="true" />
        <p className={styles.statusMeta}>{t('auth.verifyingMsg')}</p>
      </div>
    </AuthLayout>
  );
}

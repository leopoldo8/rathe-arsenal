import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { localizeAuthError } from '../auth/localize-auth-error';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? '',
  }),
});

function VerifyEmailPage(): React.ReactElement {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg(t('auth.verifyNoToken')); return; }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        // A3: verified users land on /onboarding per R43
        setTimeout(() => void navigate({ to: '/onboarding' }), 1500);
      })
      .catch((err: unknown) => { setStatus('error'); setErrorMsg(localizeAuthError(err, t)); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === 'error') {
    return (
      <AuthLayout
        title={t('auth.verifyFailedTitle')}
        tagline={t('auth.verifyFailedTagline')}
        footer={<Link to="/sign-up" className={styles.footerLink}>{t('auth.signUpAgainLink')}</Link>}
      >
        <div role="alert" className={styles.errorBox}>
          <p>{errorMsg || t('auth.verifyExpiredFallback')}</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout
        title={t('auth.verifySuccessTitle')}
        subtitle={t('auth.verifySuccessSubtitle')}
        tagline={t('auth.verifySuccessTagline')}
        footer={<Link to="/onboarding" className={styles.footerLink}>{t('auth.continueToOnboarding')}</Link>}
      >
        <div className={styles.successBanner} role="status">
          <span>{t('auth.verifySuccessMsg')}</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('auth.verifyingTitle')} tagline={t('auth.verifyingTagline')}>
      <div className={styles.statusPending}>
        <div className={styles.statusIcon} aria-hidden="true">◆</div>
        <p className={styles.statusMeta}>{t('auth.verifyingMsg')}</p>
      </div>
    </AuthLayout>
  );
}

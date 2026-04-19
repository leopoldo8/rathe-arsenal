import React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? '',
  }),
});

function VerifyEmailPage(): React.ReactElement {
  const { token } = Route.useSearch();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('No verification token provided.'); return; }
    verifyEmail(token)
      .then(() => {
        setStatus('success');
        // A3: verified users land on /onboarding per R43
        setTimeout(() => void navigate({ to: '/onboarding' }), 1500);
      })
      .catch((err: Error) => { setStatus('error'); setErrorMsg(err.message); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === 'error') {
    return (
      <AuthLayout
        title="Verification failed"
        tagline="The seal could not be set."
        footer={<Link to="/sign-up" className={styles.footerLink}>Sign up again</Link>}
      >
        <div role="alert" className={styles.infoBox}>
          <p>{errorMsg || 'This link is invalid or has expired.'}</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout
        title="Email verified"
        subtitle="Welcome to the arsenal."
        tagline="The seal is set."
        footer={<Link to="/onboarding" className={styles.footerLink}>Continue to onboarding →</Link>}
      >
        <div className={styles.successBanner} role="status">
          <span>Your email is confirmed. Redirecting…</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verifying…" tagline="The seal is being set.">
      <div className={styles.statusPending}>
        <div className={styles.statusIcon} aria-hidden="true">◆</div>
        <p className={styles.statusMeta}>Confirming seal…</p>
      </div>
    </AuthLayout>
  );
}

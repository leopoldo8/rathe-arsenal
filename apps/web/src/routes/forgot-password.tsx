import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage(): React.ReactElement {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (!email) return;
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      // Rate limit is user-visible (they actually need to wait). Any other
      // error is silently swallowed to avoid leaking account existence.
      if (err instanceof AuthFetchError && err.status === 429) {
        setError(formatRateLimitMessage(err.retryAfterSeconds));
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout
        title={t('auth.forgotSentTitle')}
        tagline={t('auth.forgotSentTagline')}
        footer={<Link to="/sign-in" className={styles.footerLink}>{t('auth.backToSignIn')}</Link>}
      >
        <div className={styles.infoBox}>
          <div className={styles.infoIcon} aria-hidden="true">✉</div>
          <div>
            <p className={styles.infoTitle}>{t('auth.forgotSentToInbox')}</p>
            <p className={styles.infoCopy}>
              {t('auth.forgotSentCopy')}
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      tagline={t('auth.forgotTagline')}
      error={error}
      footer={<Link to="/sign-in" className={styles.footerLink}>{t('auth.backToSignIn')}</Link>}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="forgot-email">{t('auth.emailLabel')}</label>
        <input
          id="forgot-email"
          className={styles.input}
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <button
          type="submit"
          className={styles.submitBtn}
          aria-disabled={loading ? 'true' : undefined}
          aria-busy={loading ? 'true' : undefined}
        >
          {loading ? t('auth.sending') : t('auth.sendResetLinkBtn')}
        </button>
      </form>
    </AuthLayout>
  );
}

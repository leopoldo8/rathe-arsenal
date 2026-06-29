import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
});

function SignUpPage(): React.ReactElement {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError(t('auth.allFieldsRequired')); return; }
    setLoading(true);
    try {
      await signUp(email, password);
      void navigate({ to: '/check-your-email' });
    } catch (err) {
      if (err instanceof AuthFetchError && err.status === 429) {
        setError(formatRateLimitMessage(err.retryAfterSeconds));
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      tagline={t('auth.signUpTagline')}
      error={error}
      footer={
        <span>
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/sign-in" className={styles.footerLink}>{t('auth.signInLink')}</Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="sign-up-email">{t('auth.emailLabel')}</label>
        <input
          id="sign-up-email"
          className={styles.input}
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label className={styles.label} htmlFor="sign-up-password">{t('auth.passwordLabel')}</label>
        <input
          id="sign-up-password"
          className={styles.input}
          type="password"
          placeholder={t('auth.passwordMinPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className={styles.hint}>{t('auth.passwordMinHint')}</p>
        <button
          type="submit"
          className={styles.submitBtn}
          aria-disabled={loading ? 'true' : undefined}
          aria-busy={loading ? 'true' : undefined}
        >
          {loading ? t('auth.creating') : t('auth.createAccountBtn')}
        </button>
        <p className={styles.termsNote}>
          {t('auth.termsNote')}
        </p>
      </form>
    </AuthLayout>
  );
}

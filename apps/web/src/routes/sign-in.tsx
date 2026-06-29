import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FormEvent, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { localizeAuthError } from '../auth/localize-auth-error';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './sign-in.module.css';

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
});

function SignInPage(): React.ReactElement {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError(t('auth.allFieldsRequired')); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      void navigate({ to: '/' });
    } catch (err) {
      setError(localizeAuthError(err, t));
      // Focus password field for quick retry on a non-rate-limit error.
      if (!(err instanceof AuthFetchError && err.status === 429)) {
        passwordRef.current?.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      tagline={t('auth.signInTagline')}
      error={error}
      footer={
        <>
          <Link to="/forgot-password" className={styles.footerLink}>{t('auth.forgotPasswordLink')}</Link>
          <span>
            {t('auth.noAccountText')}{' '}
            <Link to="/sign-up" className={styles.footerLink}>{t('auth.createOneLink')}</Link>
          </span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="sign-in-email">{t('auth.emailLabel')}</label>
        <input
          id="sign-in-email"
          className={styles.input}
          type="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label className={styles.label} htmlFor="sign-in-password">{t('auth.passwordLabel')}</label>
        <input
          id="sign-in-password"
          className={styles.input}
          type="password"
          placeholder={t('auth.passwordPlaceholder')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          ref={passwordRef}
          required
        />
        <button
          type="submit"
          className={styles.submitBtn}
          aria-disabled={loading ? 'true' : undefined}
          aria-busy={loading ? 'true' : undefined}
        >
          {loading ? t('auth.signingIn') : t('auth.signInBtn')}
        </button>
      </form>
    </AuthLayout>
  );
}

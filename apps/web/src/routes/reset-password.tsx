import React from 'react';
import { useTranslation } from 'react-i18next';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './auth-form.module.css';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? '',
  }),
});

function ResetPasswordPage(): React.ReactElement {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (!token) { setError(t('auth.resetMissingToken')); return; }
    if (newPassword.length < 10) { setError(t('auth.resetPasswordTooShort')); return; }
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      void navigate({ to: '/' });
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
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle')}
      tagline={t('auth.resetTagline')}
      error={error}
      footer={<Link to="/sign-in" className={styles.footerLink}>{t('auth.backToSignIn')}</Link>}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="reset-password">{t('auth.newPasswordLabel')}</label>
        <input
          id="reset-password"
          className={styles.input}
          type="password"
          placeholder={t('auth.passwordMinPlaceholder')}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={10}
          required
        />
        <button
          type="submit"
          className={styles.submitBtn}
          aria-disabled={loading ? 'true' : undefined}
          aria-busy={loading ? 'true' : undefined}
        >
          {loading ? t('auth.resetting') : t('auth.updatePasswordBtn')}
        </button>
      </form>
    </AuthLayout>
  );
}

import React from 'react';
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
  const { token } = Route.useSearch();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (!token) { setError('Missing reset token'); return; }
    if (newPassword.length < 10) { setError('Password must be at least 10 characters'); return; }
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
      title="Set a new password"
      subtitle="Choose carefully — your arsenal awaits."
      tagline="A new key, a new campaign."
      error={error}
      footer={<Link to="/sign-in" className={styles.footerLink}>Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          className={styles.input}
          type="password"
          placeholder="At least 10 characters"
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
          {loading ? 'Resetting…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}

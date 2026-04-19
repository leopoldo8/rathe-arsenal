import React from 'react';
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
        title="Check your email"
        tagline="The raven has flown."
        footer={<Link to="/sign-in" className={styles.footerLink}>Back to sign in</Link>}
      >
        <div className={styles.infoBox}>
          <div className={styles.infoIcon} aria-hidden="true">✉</div>
          <div>
            <p className={styles.infoTitle}>Sent to your inbox</p>
            <p className={styles.infoCopy}>
              If an account exists for that email, we sent a password reset link.
              Check your spam folder if you don&apos;t see it in 2 minutes.
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a reset link."
      tagline="Lost the key? We'll forge another."
      error={error}
      footer={<Link to="/sign-in" className={styles.footerLink}>Back to sign in</Link>}
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          className={styles.input}
          type="email"
          placeholder="hero@rathe.gg"
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
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  );
}

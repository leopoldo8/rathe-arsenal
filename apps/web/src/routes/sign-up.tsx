import React from 'react';
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
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('All fields are required'); return; }
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
      title="Create your account"
      subtitle="Start tracking in under a minute."
      tagline="Join the armory."
      error={error}
      footer={
        <span>
          Already have one?{' '}
          <Link to="/sign-in" className={styles.footerLink}>Sign in</Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="sign-up-email">Email</label>
        <input
          id="sign-up-email"
          className={styles.input}
          type="email"
          placeholder="hero@rathe.gg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label className={styles.label} htmlFor="sign-up-password">Password</label>
        <input
          id="sign-up-password"
          className={styles.input}
          type="password"
          placeholder="At least 10 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className={styles.hint}>At least 10 characters.</p>
        <button
          type="submit"
          className={styles.submitBtn}
          aria-disabled={loading ? 'true' : undefined}
          aria-busy={loading ? 'true' : undefined}
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
        <p className={styles.termsNote}>
          By creating an account you accept the terms. We&apos;ll send a verification
          link to confirm your email.
        </p>
      </form>
    </AuthLayout>
  );
}

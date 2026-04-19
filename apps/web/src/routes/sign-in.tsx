import React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FormEvent, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';
import { AuthLayout } from '../components/auth-layout/AuthLayout';
import styles from './sign-in.module.css';

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
});

function SignInPage(): React.ReactElement {
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
    if (!email || !password) { setError('All fields are required'); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      void navigate({ to: '/' });
    } catch (err) {
      if (err instanceof AuthFetchError && err.status === 429) {
        setError(formatRateLimitMessage(err.retryAfterSeconds));
      } else {
        setError((err as Error).message);
        // Focus password field for quick retry after invalid-credentials error
        passwordRef.current?.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back, Hero."
      tagline="Welcome back to the armory."
      error={error}
      footer={
        <>
          <Link to="/forgot-password" className={styles.footerLink}>Forgot password?</Link>
          <span>
            No account?{' '}
            <Link to="/sign-up" className={styles.footerLink}>Create one</Link>
          </span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <label className={styles.label} htmlFor="sign-in-email">Email</label>
        <input
          id="sign-in-email"
          className={styles.input}
          type="email"
          placeholder="hero@rathe.gg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label className={styles.label} htmlFor="sign-in-password">Password</label>
        <input
          id="sign-in-password"
          className={styles.input}
          type="password"
          placeholder="Password"
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
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}

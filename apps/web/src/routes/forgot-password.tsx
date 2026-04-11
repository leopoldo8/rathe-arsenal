import { createFileRoute, Link } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
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
      <section style={{ maxWidth: 400 }}>
        <h1>Check your email</h1>
        <p>If an account exists for that email, we sent a password reset link. Check your inbox.</p>
        <Link to="/sign-in">Back to sign in</Link>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 400 }}>
      <h1>Forgot your password?</h1>
      <p>Enter your email and we will send you a reset link.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        <Link to="/sign-in">Back to sign in</Link>
      </p>
    </section>
  );
}

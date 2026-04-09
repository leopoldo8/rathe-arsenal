import { createFileRoute, Link } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // Always show success — do not leak account existence
    }
    setSent(true);
    setLoading(false);
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
        <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
        <Link to="/sign-in">Back to sign in</Link>
      </p>
    </section>
  );
}

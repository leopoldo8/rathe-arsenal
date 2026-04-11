import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError } from '../auth/AuthProvider';
import { formatRateLimitMessage } from '../auth/rate-limit-message';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? '',
  }),
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
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
    <section style={{ maxWidth: 400 }}>
      <h1>Reset your password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input type="password" placeholder="New password (10+ characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} required />
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Resetting...' : 'Reset password'}</button>
      </form>
    </section>
  );
}

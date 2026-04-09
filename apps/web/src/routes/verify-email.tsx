import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) ?? '',
  }),
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMsg('No verification token provided.'); return; }
    verifyEmail(token)
      .then(() => { setStatus('success'); setTimeout(() => void navigate({ to: '/' }), 1500); })
      .catch((err: Error) => { setStatus('error'); setErrorMsg(err.message); });
  }, [token, verifyEmail, navigate]);

  return (
    <section style={{ maxWidth: 400 }}>
      {status === 'verifying' && <p>Verifying your email...</p>}
      {status === 'success' && <p>Email verified! Redirecting...</p>}
      {status === 'error' && (
        <>
          <h1>Verification failed</h1>
          <p>{errorMsg || 'This link is invalid or has expired.'}</p>
          <Link to="/sign-up">Sign up again</Link>
        </>
      )}
    </section>
  );
}

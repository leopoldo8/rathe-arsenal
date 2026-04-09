import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/check-your-email')({
  component: CheckYourEmailPage,
});

function CheckYourEmailPage() {
  return (
    <section style={{ maxWidth: 400 }}>
      <h1>Check your email</h1>
      <p>We sent a verification link to your email address. Click it to complete sign-up.</p>
      <p style={{ fontSize: '0.875rem', color: '#888' }}>
        The link expires in 24 hours. If you do not see the email, check your spam folder.
      </p>
      <Link to="/sign-in">Already verified? Sign in</Link>
    </section>
  );
}

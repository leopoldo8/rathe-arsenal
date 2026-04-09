import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from '../auth/useAuth';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <p>Loading...</p>;
  return (
    <section>
      <h1>Welcome to Rathe Arsenal</h1>
      <p>Closed beta. Track your Flesh and Blood decks against your collection.</p>
      {!user ? (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <Link to="/sign-in">Sign in</Link>
          <Link to="/sign-up">Sign up</Link>
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <p>You are signed in as {user.email}.</p>
          <Link to="/home">Go to your decks</Link>
        </div>
      )}
    </section>
  );
}

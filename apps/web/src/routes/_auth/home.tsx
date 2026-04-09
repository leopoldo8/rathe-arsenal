import { createFileRoute, Link } from '@tanstack/react-router';
import { useDecksQuery, useUntrackDeckMutation } from '../../api/decks';
import { TrackedDeckCard } from '../../components/tracked-deck-card';

export const Route = createFileRoute('/_auth/home')({
  component: HomePage,
});

function HomePage() {
  const decksQuery = useDecksQuery();
  const untrackMutation = useUntrackDeckMutation();

  if (decksQuery.isLoading) {
    return <p>Loading your decks...</p>;
  }

  if (decksQuery.isError) {
    return (
      <div style={{ color: '#e53e3e' }}>
        <p>Failed to load decks: {(decksQuery.error as Error).message}</p>
        <button onClick={() => decksQuery.refetch()} style={{ cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const decks = decksQuery.data ?? [];

  if (decks.length === 0) {
    return (
      <section style={{ maxWidth: '480px' }}>
        <h1>Your Decks</h1>
        <p style={{ color: '#666' }}>
          No tracked decks. Paste a Fabrary URL to get started.
        </p>
        <Link to="/onboarding" style={{ display: 'inline-block', marginTop: '0.5rem' }}>
          Import your first deck
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Your Decks</h1>
        <Link to="/onboarding">+ Import more</Link>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {decks.map((deck) => (
          <TrackedDeckCard
            key={deck.id}
            deck={deck}
            onUntrack={(deckId) => untrackMutation.mutate(deckId)}
            isUntracking={
              untrackMutation.isPending &&
              untrackMutation.variables === deck.id
            }
          />
        ))}
      </div>
    </section>
  );
}

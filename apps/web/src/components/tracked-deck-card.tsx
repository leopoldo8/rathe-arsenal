import { Link } from '@tanstack/react-router';
import { ITrackedDeckListItem } from '../api/decks';

interface ITrackedDeckCardProps {
  readonly deck: ITrackedDeckListItem;
  readonly onUntrack: (deckId: number) => void;
  readonly isUntracking: boolean;
}

export function TrackedDeckCard({ deck, onUntrack, isUntracking }: ITrackedDeckCardProps) {
  const effectivePercent = deck.latestSnapshot?.effectivePercent ?? null;

  function handleUntrack(): void {
    const confirmed = window.confirm(
      `Untrack "${deck.name}"? This will remove the deck and all its readiness data.`,
    );
    if (confirmed) {
      onUntrack(deck.id);
    }
  }

  return (
    <div
      style={{
        border: '1px solid #e5e5e5',
        borderRadius: '8px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(deck.id) }}
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <h3 style={{ margin: 0 }}>{deck.name}</h3>
        <div style={{ color: '#666', fontSize: '0.875rem' }}>
          {deck.hero} -- {deck.format}
        </div>
        {effectivePercent !== null ? (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: effectivePercent >= 80 ? '#38a169' : effectivePercent >= 50 ? '#d69e2e' : '#e53e3e',
            }}
          >
            {effectivePercent.toFixed(1)}% ready
          </div>
        ) : (
          <div style={{ marginTop: '0.5rem', color: '#999', fontSize: '0.875rem' }}>
            No readiness data yet
          </div>
        )}
      </Link>
      <div style={{ marginTop: '0.25rem' }}>
        <button
          onClick={handleUntrack}
          disabled={isUntracking}
          style={{
            cursor: isUntracking ? 'not-allowed' : 'pointer',
            color: '#e53e3e',
            background: 'none',
            border: '1px solid #e53e3e',
            borderRadius: '4px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
          }}
        >
          {isUntracking ? 'Removing...' : 'Untrack'}
        </button>
      </div>
    </div>
  );
}

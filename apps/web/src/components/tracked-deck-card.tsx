import { Link } from '@tanstack/react-router';
import { ITrackedDeckListItem } from '../api/decks';
import styles from './tracked-deck-card.module.css';

interface ITrackedDeckCardProps {
  readonly deck: ITrackedDeckListItem;
  readonly onUntrack: (deckId: number) => void;
  readonly isUntracking: boolean;
}

function getReadinessTier(percent: number): 'high' | 'mid' | 'low' {
  if (percent >= 80) return 'high';
  if (percent >= 50) return 'mid';
  return 'low';
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
    <div className={styles.card}>
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(deck.id) }}
        className={styles.deckLink}
      >
        <h3 className={styles.deckName}>{deck.name}</h3>
        <div className={styles.deckMeta}>
          {deck.hero} -- {deck.format}
        </div>
        {effectivePercent !== null ? (
          <div
            className={styles.readinessPercent}
            data-tier={getReadinessTier(effectivePercent)}
          >
            {effectivePercent.toFixed(1)}% ready
          </div>
        ) : (
          <div className={styles.noReadiness}>
            No readiness data yet
          </div>
        )}
      </Link>
      <div className={styles.cardFooter}>
        <button
          onClick={handleUntrack}
          disabled={isUntracking}
          className={styles.untrackBtn}
        >
          {isUntracking ? 'Removing...' : 'Untrack'}
        </button>
      </div>
    </div>
  );
}

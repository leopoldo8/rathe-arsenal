import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const effectivePercent = deck.latestSnapshot?.effectivePercent ?? null;

  function handleUntrack(): void {
    const confirmed = window.confirm(
      t('decks.untrackConfirm', { name: deck.name }),
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
        search={{ edit: undefined }}
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
            {t('decks.readinessPercent', { percent: effectivePercent.toFixed(1) })}
          </div>
        ) : (
          <div className={styles.noReadiness}>
            {t('decks.noReadinessData')}
          </div>
        )}
      </Link>
      <div className={styles.cardFooter}>
        <button
          onClick={handleUntrack}
          disabled={isUntracking}
          className={styles.untrackBtn}
        >
          {isUntracking ? t('decks.removing') : t('decks.untrack')}
        </button>
      </div>
    </div>
  );
}

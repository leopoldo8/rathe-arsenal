import React from 'react';
import { Link } from '@tanstack/react-router';
import { ITrackedDeckListItem } from '../../api/decks';
import { Button } from '../ui/Button/Button';
import styles from './DeckCard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IDeckCardProps {
  readonly deck: ITrackedDeckListItem;
  readonly onUntrack: (deckId: number) => void;
  readonly isUntracking: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveReadinessTier(effectivePercent: number): 'high' | 'mid' | 'low' {
  if (effectivePercent >= 80) return 'high';
  if (effectivePercent >= 50) return 'mid';
  return 'low';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DeckCard — compact tracked-deck card for the home readiness shelves.
 *
 * Footer actions:
 *  - At ≥640px: View (primary brass CTA) and Untrack sit side-by-side.
 *  - At <640px (320px): View is a full-width primary CTA; Untrack moves into
 *    an overflow <details>/<summary> disclosed area to keep the primary action
 *    prominent without a third-party dropdown dependency.
 *
 * Signature treatment:
 *  - `.ra-readiness-display` wraps the effectivePercent % value only.
 *    This class is RESERVED for deck readiness percentages (R7).
 *    Do NOT apply it to other numbers.
 */
export function DeckCard({ deck, onUntrack, isUntracking }: IDeckCardProps): React.ReactElement {
  const effectivePercent = deck.latestSnapshot?.effectivePercent ?? null;
  const tier = effectivePercent !== null ? resolveReadinessTier(effectivePercent) : null;

  function handleUntrack(): void {
    const confirmed = window.confirm(
      `Untrack "${deck.name}"? This will remove the deck and all its readiness data.`,
    );
    if (confirmed) {
      onUntrack(deck.id);
    }
  }

  const cardClasses = [
    styles.card,
    tier !== null ? styles[`card--${tier}`] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClasses} aria-label={deck.name}>
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(deck.id) }}
        className={styles.cardLink}
      >
        <h3 className={styles.cardName}>{deck.name}</h3>
        <div className={styles.cardMeta}>
          {deck.hero} &mdash; {deck.format}
        </div>
        {effectivePercent !== null ? (
          <div className={styles.cardReadiness}>
            <span className={`${styles.readinessDisplay} ra-readiness-display`}>
              {effectivePercent.toFixed(1)}%
            </span>
            <span className={styles.readinessLabel}>ready</span>
          </div>
        ) : (
          <div className={styles.cardNoReadiness}>No readiness data yet</div>
        )}
      </Link>

      <div className={styles.cardFooter}>
        {/* Wide layout (≥640px): side-by-side actions */}
        <div className={styles.actionsWide}>
          <Link
            to="/decks/$deckId"
            params={{ deckId: String(deck.id) }}
            className={styles.viewLink}
          >
            <Button variant="primary" size="sm">
              View
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={handleUntrack}
            loading={isUntracking}
            disabled={isUntracking}
          >
            Untrack
          </Button>
        </div>

        {/* Narrow layout (<640px): View full-width, Untrack in overflow */}
        <div className={styles.actionsNarrow}>
          <Link
            to="/decks/$deckId"
            params={{ deckId: String(deck.id) }}
            className={styles.viewLinkFull}
          >
            <Button variant="primary" size="sm" className={styles.viewButtonFull}>
              View deck
            </Button>
          </Link>
          <details className={styles.overflowMenu}>
            <summary className={styles.overflowTrigger} aria-label="More actions">
              &hellip;
            </summary>
            <div className={styles.overflowContent}>
              <Button
                variant="danger"
                size="sm"
                onClick={handleUntrack}
                loading={isUntracking}
                disabled={isUntracking}
              >
                Untrack deck
              </Button>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

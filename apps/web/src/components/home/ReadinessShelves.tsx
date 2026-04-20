import React, { useId } from 'react';
import { ITrackedDeckListItem } from '../../api/decks';
import { DeckCard } from './DeckCard';
import styles from './ReadinessShelves.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IReadinessShelvesProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
}

type TReadinessTier = 'ready' | 'almost' | 'needs';

interface IShelfConfig {
  readonly tier: TReadinessTier;
  readonly label: string;
  readonly rangeLabel: string;
  readonly tierClass: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHELF_CONFIGS: readonly IShelfConfig[] = [
  {
    tier: 'ready',
    label: 'Ready to play',
    rangeLabel: '≥80%',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    tierClass: styles.diamondHigh!,
  },
  {
    tier: 'almost',
    label: 'Almost there',
    rangeLabel: '50–80%',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    tierClass: styles.diamondMid!,
  },
  {
    tier: 'needs',
    label: 'Needs collection',
    rangeLabel: '<50%',
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    tierClass: styles.diamondLow!,
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterByTier(
  decks: readonly ITrackedDeckListItem[],
  tier: TReadinessTier,
): readonly ITrackedDeckListItem[] {
  return decks.filter((deck) => {
    const pct = deck.latestSnapshot?.effectivePercent ?? null;
    if (pct === null) return tier === 'needs';
    if (tier === 'ready') return pct >= 80;
    if (tier === 'almost') return pct >= 50 && pct < 80;
    return pct < 50;
  });
}

// ---------------------------------------------------------------------------
// Sub-component: single shelf
// ---------------------------------------------------------------------------

interface IReadinessShelfProps {
  readonly config: IShelfConfig;
  readonly decks: readonly ITrackedDeckListItem[];
  readonly headingId: string;
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
}

function ReadinessShelf({
  config,
  decks,
  headingId,
  onUntrack,
  untrackingDeckId,
}: IReadinessShelfProps): React.ReactElement {
  return (
    <section className={styles.shelf} aria-labelledby={headingId}>
      <div className={styles.shelfHead}>
        <div className={styles.shelfTitle}>
          <span
            className={`${styles.diamond} ${config.tierClass}`}
            aria-hidden="true"
          />
          <h2 id={headingId} className={styles.shelfHeading}>
            {config.label}
          </h2>
          <span className={styles.shelfCount}>
            {decks.length} {decks.length === 1 ? 'deck' : 'decks'} &middot; {config.rangeLabel}
          </span>
        </div>
      </div>
      <div className={styles.deckGrid}>
        {decks.map((deck) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            onUntrack={onUntrack}
            isUntracking={untrackingDeckId === deck.id}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ReadinessShelves — renders up to 3 filtered deck shelves:
 *  - Ready to play (effectivePercent >= 80%)
 *  - Almost there (50% <= effectivePercent < 80%)
 *  - Needs collection (effectivePercent < 50%, or no snapshot)
 *
 * Empty shelves do not render. When all decks fall into one shelf, only
 * that shelf renders — no empty placeholders (origin R20).
 *
 * Each shelf is a `<section aria-labelledby={headingId}>` with an `<h2>`
 * heading per the accessibility requirement (origin R20, test scenario a11y).
 */
export function ReadinessShelves({
  decks,
  onUntrack,
  untrackingDeckId,
}: IReadinessShelvesProps): React.ReactElement {
  const baseId = useId();

  return (
    <div className={styles.shelves}>
      {SHELF_CONFIGS.map((config) => {
        const shelfDecks = filterByTier(decks, config.tier);
        if (shelfDecks.length === 0) return null;

        const headingId = `${baseId}-shelf-${config.tier}`;

        return (
          <ReadinessShelf
            key={config.tier}
            config={config}
            decks={shelfDecks}
            headingId={headingId}
            onUntrack={onUntrack}
            untrackingDeckId={untrackingDeckId}
          />
        );
      })}
    </div>
  );
}

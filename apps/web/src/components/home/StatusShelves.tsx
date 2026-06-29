import React, { useId, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ITrackedDeckListItem, TDeckStatus } from '../../api/decks';
import { STATUS_LABELS } from '../deck-detail/StatusBullet';
import { DeckCard } from './DeckCard';
import styles from './StatusShelves.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IStatusShelvesProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
  /**
   * Active tag filter chips. When non-empty, each shelf only shows decks
   * that have AT LEAST ONE of these tags (OR logic). Empty array = no
   * filter, all decks in each shelf are shown.
   */
  readonly activeFilterTags: readonly string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Status display order per U9 spec: [active, ready, building, idea, retired].
 * Retired always renders last and starts collapsed.
 */
const STATUS_ORDER: readonly TDeckStatus[] = [
  'active',
  'ready',
  'building',
  'idea',
  'retired',
] as const;

/**
 * localStorage key for the retired shelf expanded/collapsed state.
 * Defaults to `false` (collapsed).
 */
const RETIRED_EXPANDED_KEY = 'ra-shelf-retired-expanded';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterByStatus(
  decks: readonly ITrackedDeckListItem[],
  status: TDeckStatus,
): readonly ITrackedDeckListItem[] {
  return decks.filter((d) => d.status === status);
}

/**
 * Applies OR-logic tag filtering. If `activeTags` is empty, returns all
 * decks unchanged.
 */
function applyTagFilter(
  decks: readonly ITrackedDeckListItem[],
  activeTags: readonly string[],
): readonly ITrackedDeckListItem[] {
  if (activeTags.length === 0) return decks;
  return decks.filter((d) => d.tags.some((t) => activeTags.includes(t)));
}

function readRetiredExpanded(): boolean {
  try {
    const raw = localStorage.getItem(RETIRED_EXPANDED_KEY);
    if (raw === null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

function writeRetiredExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(RETIRED_EXPANDED_KEY, JSON.stringify(expanded));
  } catch {
    // localStorage unavailable (e.g. in tests without jsdom mock) — ignore
  }
}

// ---------------------------------------------------------------------------
// Sub-component: single shelf header + grid
// ---------------------------------------------------------------------------

interface IStatusShelfProps {
  readonly status: TDeckStatus;
  readonly decks: readonly ITrackedDeckListItem[];
  readonly headingId: string;
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
}

function StatusShelf({
  status,
  decks,
  headingId,
  onUntrack,
  untrackingDeckId,
}: IStatusShelfProps): React.ReactElement {
  const { t } = useTranslation();
  const deckCountLabel = decks.length === 1
    ? t('home.deckCountSingular')
    : t('home.deckCountPlural', { count: decks.length });
  return (
    <section className={styles.shelf} aria-labelledby={headingId}>
      <div className={styles.shelfHead}>
        <div className={styles.shelfTitle}>
          <span
            className={styles.statusDot}
            data-status={status}
            aria-hidden="true"
          />
          <h2 id={headingId} className={styles.shelfHeading}>
            {STATUS_LABELS[status]}
          </h2>
          <span className={styles.shelfCount}>
            {deckCountLabel}
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
// Sub-component: collapsible retired shelf
// ---------------------------------------------------------------------------

interface IRetiredShelfProps {
  readonly decks: readonly ITrackedDeckListItem[];
  readonly headingId: string;
  readonly onUntrack: (deckId: number) => void;
  readonly untrackingDeckId: number | null;
  /** True when every deck in the parent list has status 'retired'. */
  readonly isAllRetired: boolean;
}

function RetiredShelf({
  decks,
  headingId,
  onUntrack,
  untrackingDeckId,
  isAllRetired,
}: IRetiredShelfProps): React.ReactElement {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<boolean>(readRetiredExpanded);

  const deckCountLabel = decks.length === 1
    ? t('home.deckCountSingular')
    : t('home.deckCountPlural', { count: decks.length });

  function handleToggle(): void {
    const next = !expanded;
    setExpanded(next);
    writeRetiredExpanded(next);
  }

  return (
    <section className={styles.shelf} aria-labelledby={headingId}>
      <div className={styles.shelfHead}>
        <div className={styles.shelfTitle}>
          <span
            className={styles.statusDot}
            data-status="retired"
            aria-hidden="true"
          />
          <h2 id={headingId} className={styles.shelfHeading}>
            {STATUS_LABELS['retired']}
          </h2>
          <span className={styles.shelfCount}>
            {deckCountLabel}
          </span>
        </div>
        <button
          type="button"
          className={styles.retiredToggle}
          aria-expanded={expanded}
          aria-controls={`${headingId}-content`}
          onClick={handleToggle}
          aria-label={expanded ? t('home.retiredCollapseAriaLabel') : t('home.retiredExpandAriaLabel')}
        >
          <span
            className={`${styles.chevron} ${expanded ? styles.chevronUp : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* All-retired empty state — only shown when every deck is retired and
          the shelf is collapsed. Disappears when user expands or adds a
          non-retired deck. */}
      {isAllRetired && !expanded && (
        <div className={styles.allRetiredEmptyState}>
          {t('home.allRetiredEmptyState')}{' '}
          <button
            type="button"
            className={styles.allRetiredExpandBtn}
            onClick={handleToggle}
          >
            {t('home.expandToView')}
          </button>{' '}
          ·{' '}
          <Link to="/decks/new" className={styles.allRetiredAddLink}>
            {t('home.addNewDeckLink')}
          </Link>
        </div>
      )}

      {expanded && (
        <div id={`${headingId}-content`} className={styles.deckGrid}>
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onUntrack={onUntrack}
              isUntracking={untrackingDeckId === deck.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * StatusShelves — renders up to 5 deck shelves grouped by lifecycle status,
 * in the order [active, ready, building, idea, retired].
 *
 * Empty status groups are skipped entirely. The Retired shelf starts collapsed
 * by default and persists its expanded/collapsed state to localStorage under
 * `ra-shelf-retired-expanded`.
 *
 * When ALL decks are retired, a small empty-state block renders under the
 * collapsed Retired shelf header to prevent a confusing near-empty home.
 * This block does NOT render when the user has zero decks total (the
 * top-level empty-home component owns that state).
 *
 * `activeFilterTags`: OR-logic tag filter applied per shelf before rendering.
 * Empty array = no filter.
 */
export function StatusShelves({
  decks,
  onUntrack,
  untrackingDeckId,
  activeFilterTags,
}: IStatusShelvesProps): React.ReactElement {
  const baseId = useId();

  const allRetired =
    decks.length > 0 && decks.every((d) => d.status === 'retired');

  return (
    <div className={styles.shelves}>
      {STATUS_ORDER.map((status) => {
        const statusDecks = filterByStatus(decks, status);
        if (statusDecks.length === 0) return null;

        const filteredDecks = applyTagFilter(statusDecks, activeFilterTags);
        // If tag filter is active but no deck in this shelf matches, skip the shelf
        if (activeFilterTags.length > 0 && filteredDecks.length === 0) return null;

        const headingId = `${baseId}-shelf-${status}`;

        if (status === 'retired') {
          return (
            <RetiredShelf
              key={status}
              decks={filteredDecks}
              headingId={headingId}
              onUntrack={onUntrack}
              untrackingDeckId={untrackingDeckId}
              isAllRetired={allRetired}
            />
          );
        }

        return (
          <StatusShelf
            key={status}
            status={status}
            decks={filteredDecks}
            headingId={headingId}
            onUntrack={onUntrack}
            untrackingDeckId={untrackingDeckId}
          />
        );
      })}
    </div>
  );
}

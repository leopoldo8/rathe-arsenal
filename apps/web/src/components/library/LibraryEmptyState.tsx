import React from 'react';
import styles from './LibraryEmptyState.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ILibraryEmptyStateProps {
  /** Callback to focus the search input — allows the empty state CTA to
   * direct keyboard users directly to the search bar. */
  readonly onFocusSearch?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * LibraryEmptyState — shown when the user owns zero cards.
 *
 * Two CTAs:
 *  1. "Manage CSVs" — routes to /library-csv-sources.
 *  2. "Search and add a card" — focuses the LibrarySearchAddBar input.
 *
 * Copy: educational, action-oriented, no jargon.
 */
export function LibraryEmptyState({ onFocusSearch }: ILibraryEmptyStateProps): React.ReactElement {
  return (
    <section className={styles.container} aria-labelledby="library-empty-heading">
      <div className={styles.icon} aria-hidden="true">
        &#9651;
      </div>

      <h2 id="library-empty-heading" className={styles.heading}>
        Your library is empty
      </h2>

      <p className={styles.body}>
        Add cards by importing a collection CSV, or search and add individual cards above.
      </p>

      <div className={styles.ctas}>
        {/* /library-csv-sources is the U9 route, not yet in the router tree.
            Use a plain anchor so the link is live now and typecheck stays clean. */}
        <a href="/library-csv-sources" className={styles.primaryCta}>
          Manage CSVs
        </a>

        {onFocusSearch && (
          <button type="button" className={styles.secondaryCta} onClick={onFocusSearch}>
            Search and add a card
          </button>
        )}
      </div>
    </section>
  );
}

import React from 'react';
import styles from './CsvSourcesEmptyState.module.css';

interface ICsvSourcesEmptyStateProps {
  /** Called when the user clicks the "Upload CSV" CTA. */
  readonly onUpload: () => void;
}

/**
 * Empty state shown when the user has no CSV sources imported.
 */
export function CsvSourcesEmptyState({
  onUpload,
}: ICsvSourcesEmptyStateProps): React.ReactElement {
  return (
    <div className={styles.root} role="region" aria-label="No CSV sources">
      <div className={styles.icon} aria-hidden="true">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="8"
            y="6"
            width="26"
            height="36"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M34 12h4a2 2 0 012 2v28a2 2 0 01-2 2H18"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <line x1="14" y1="18" x2="28" y2="18" stroke="currentColor" strokeWidth="2" />
          <line x1="14" y1="24" x2="28" y2="24" stroke="currentColor" strokeWidth="2" />
          <line x1="14" y1="30" x2="22" y2="30" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      <h2 className={styles.heading}>No CSVs imported yet</h2>

      <p className={styles.body}>
        Upload your first CSV to seed your library from a collection you already
        have. Duplicates across sources are summed, not overwritten.
      </p>

      <button
        type="button"
        className={styles.cta}
        onClick={onUpload}
        aria-label="Upload a CSV to import your collection"
      >
        Upload CSV
      </button>
    </div>
  );
}

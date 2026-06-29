import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { STATUS_KEY_MAP } from './status-labels';
import styles from './StatusBullet.module.css';

// Re-export STATUS_KEY_MAP so callers (home shelves/cards) localize from one source
export { STATUS_KEY_MAP } from './status-labels';

interface IStatusBulletProps {
  /** The deck lifecycle status to display. */
  readonly status: TDeckStatus;
  /** Whether to render the sibling text label alongside the bullet. Defaults to true. */
  readonly showLabel?: boolean;
  /** Additional CSS class applied to the root element. */
  readonly className?: string;
}

/**
 * StatusBullet — an 8px filled circle coloured from `--ra-status-{status}`
 * alongside an optional sibling text label.
 *
 * Used by: StatusDropdown trigger + items, home DeckCard (U9).
 * Exported as a standalone component so U9 can import it without pulling in
 * the full StatusDropdown.
 */
export function StatusBullet({
  status,
  showLabel = true,
  className,
}: IStatusBulletProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <span className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      {/* 8px filled circle coloured via the semantic status token */}
      <span
        aria-hidden="true"
        className={styles.bullet}
        data-status={status}
      />
      {showLabel ? (
        <span>{t(STATUS_KEY_MAP[status])}</span>
      ) : null}
    </span>
  );
}

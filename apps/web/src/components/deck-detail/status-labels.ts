import type { TDeckStatus } from '../../api/decks';

/**
 * Map of TDeckStatus values to human-readable display labels.
 * Exported from a separate file so StatusBullet.tsx stays component-only
 * (required for React Fast Refresh compatibility).
 *
 * Consumed by: StatusDropdown, StatusBullet, DeckCard (U9).
 */
export const STATUS_LABELS: Readonly<Record<TDeckStatus, string>> = {
  idea: 'Idea',
  building: 'Building',
  ready: 'Ready',
  active: 'Active',
  retired: 'Retired',
};

import type { TDeckStatus } from '../../api/decks';

/**
 * Maps TDeckStatus values to their i18n catalog keys (decks.statusX). The
 * actual label is resolved at render time via `t(STATUS_KEY_MAP[status])` so
 * it follows the active locale.
 *
 * Exported from a separate file so StatusBullet.tsx stays component-only
 * (required for React Fast Refresh compatibility).
 *
 * Consumed by: StatusBullet, StatusDropdown, StatusShelves, DeckCard.
 */
export const STATUS_KEY_MAP: Readonly<Record<TDeckStatus, string>> = {
  idea: 'decks.statusIdea',
  building: 'decks.statusBuilding',
  ready: 'decks.statusReady',
  active: 'decks.statusActive',
  retired: 'decks.statusRetired',
};

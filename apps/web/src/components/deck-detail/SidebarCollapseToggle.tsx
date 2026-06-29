import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SidebarCollapseToggle.module.css';

interface ISidebarCollapseToggleProps {
  /**
   * Whether the sidebar is currently expanded (visible).
   */
  readonly expanded: boolean;
  /**
   * Called when the user clicks the toggle button to change expanded state.
   */
  readonly onToggle: () => void;
}

/**
 * SidebarCollapseToggle — the "▼ Hide details" / "▶ Show details" toggle
 * rendered below 1280px at the top of the sidebar card.
 *
 * Clicking this button collapses the sidebar body (hides the hero block,
 * readiness, shopping, and fabrary link) leaving only this toggle visible.
 * State is persisted to `ra-deck-sidebar-expanded` in localStorage by the
 * parent component.
 *
 * The button is only rendered below 1280px. At desktop widths the sidebar
 * is always visible and this component is not mounted.
 */
export function SidebarCollapseToggle({
  expanded,
  onToggle,
}: ISidebarCollapseToggleProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? t('decks.hideDeckDetails') : t('decks.showDeckDetails')}
      data-testid="sidebar-collapse-toggle"
    >
      <span className={styles.toggle__chevron} aria-hidden="true">
        {expanded ? '▼' : '▶'}
      </span>
      <span className={styles.toggle__label}>
        {expanded ? t('decks.hideDetails') : t('decks.showDetails')}
      </span>
    </button>
  );
}

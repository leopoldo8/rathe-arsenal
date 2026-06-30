import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DeckDetailLayout.module.css';

interface IDeckDetailLayoutProps {
  /**
   * The full-width header strip (breadcrumb + title + action bar).
   */
  readonly header: React.ReactNode;
  /**
   * The 280px sidebar (hero block + readiness + shopping + fabrary).
   * On mobile and below 1280px this becomes a collapsible card under the header.
   */
  readonly sidebar: React.ReactNode;
  /**
   * The main canvas area (ReadinessHero banner + breakdown sections).
   * ReadinessHero renders full-width at the top of this region per UXUI-14.
   */
  readonly canvas: React.ReactNode;
}

/**
 * DeckDetailLayout — two-column shell for the deck detail view.
 *
 * Desktop (≥ 1280px): full-width header strip + 280px sidebar column + canvas column.
 * Below 1280px: sidebar collapses to a card directly under the header with a
 * `▼ Hide details` toggle. The `ra-deck-sidebar-expanded` localStorage key
 * persists the collapsed/expanded state (default: true).
 *
 * The shell owns zero data — it only arranges the three regions. Data and
 * mutations are managed by the route component (decks.$deckId.tsx).
 */
export function DeckDetailLayout({
  header,
  sidebar,
  canvas,
}: IDeckDetailLayoutProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.page} data-testid="deck-detail-layout">
      <header className={styles.header}>{header}</header>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label={t('decks.deckDetailsSidebarAria')}>
          {sidebar}
        </aside>
        <main className={styles.canvas}>{canvas}</main>
      </div>
    </div>
  );
}

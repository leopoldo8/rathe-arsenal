/**
 * CascadeWarningPanel — displays cascade legality warnings in Edit mode.
 *
 * Two surface variants:
 *  - Desktop (≥1280px): renders inside DeckDetailSidebar below the dimmed
 *    readiness block. Rendered as a compact panel.
 *  - Mobile (<1280px): rendered as a sticky banner at the canvas top (above
 *    DeckCardSearchAutocomplete). Collapsible via chevron toggle.
 *
 * Both surfaces show: "N cards may be illegal in {format}" + "Remove illegal
 * cards" button. When N=0 neither surface renders.
 *
 * The "Remove illegal cards" button always works inline (no Save gate here).
 * The Save-flow N>5 confirm is wired in U13.
 */
import React, { useState } from 'react';
import type { ICompositionDraft } from '../../hooks/useCompositionDraft';
import type { ICascadeCheckResult } from '../../hooks/useCascadeCheck';
import styles from './CascadeWarningPanel.module.css';

// ---------------------------------------------------------------------------
// Shared sub-component: warning content
// ---------------------------------------------------------------------------

interface IWarningContentProps {
  readonly count: number;
  readonly format: string;
  readonly illegalCardIds: ReadonlySet<string>;
  readonly onRemoveIllegal: (ids: ReadonlySet<string>) => void;
  readonly textClassName: string;
}

function WarningContent({
  count,
  format,
  illegalCardIds,
  onRemoveIllegal,
  textClassName,
}: IWarningContentProps): React.ReactElement {
  return (
    <>
      <p className={textClassName} data-testid="cascade-warning-text">
        {count} {count === 1 ? 'card' : 'cards'} may be illegal in {format}.
      </p>
      <button
        type="button"
        className={styles.removeBtn}
        data-testid="cascade-remove-illegal-btn"
        onClick={() => onRemoveIllegal(illegalCardIds)}
        aria-label={`Remove ${count} illegal ${count === 1 ? 'card' : 'cards'} from deck`}
      >
        Remove illegal cards
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar panel variant
// ---------------------------------------------------------------------------

export interface ICascadeWarningPanelSidebarProps {
  readonly draft: ICompositionDraft;
  readonly cascadeCheck: ICascadeCheckResult;
  readonly onRemoveIllegal: (ids: ReadonlySet<string>) => void;
}

/**
 * CascadeWarningPanel (sidebar variant) — renders when N > 0 and viewport
 * is ≥1280px. Stacks below the dimmed readiness block inside the sidebar.
 */
export function CascadeWarningPanelSidebar({
  draft,
  cascadeCheck,
  onRemoveIllegal,
}: ICascadeWarningPanelSidebarProps): React.ReactElement | null {
  if (cascadeCheck.count === 0) return null;

  return (
    <div
      className={styles.sidebarPanel}
      data-testid="cascade-warning-sidebar"
      role="status"
      aria-live="polite"
    >
      <h4 className={styles.sidebarTitle}>Cascade Warning</h4>
      <WarningContent
        count={cascadeCheck.count}
        format={draft.format}
        illegalCardIds={cascadeCheck.illegalCardIds}
        onRemoveIllegal={onRemoveIllegal}
        textClassName={styles.sidebarBody ?? ''}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile banner variant
// ---------------------------------------------------------------------------

export interface ICascadeWarningPanelBannerProps {
  readonly draft: ICompositionDraft;
  readonly cascadeCheck: ICascadeCheckResult;
  readonly onRemoveIllegal: (ids: ReadonlySet<string>) => void;
}

/**
 * CascadeWarningPanel (banner variant) — sticky banner for mobile (<1280px).
 * Collapsible via chevron. State held in component memory (not persisted).
 */
export function CascadeWarningPanelBanner({
  draft,
  cascadeCheck,
  onRemoveIllegal,
}: ICascadeWarningPanelBannerProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(true);

  if (cascadeCheck.count === 0) return null;

  return (
    <div
      className={styles.banner}
      data-testid="cascade-warning-banner"
      role="status"
      aria-live="polite"
    >
      <div
        className={styles.bannerHeader}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="cascade-banner-body"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
      >
        <p className={styles.bannerTitle}>
          {cascadeCheck.count}{' '}
          {cascadeCheck.count === 1 ? 'card' : 'cards'} may be illegal
        </p>
        <span
          className={
            expanded
              ? `${styles.bannerChevron} ${styles['bannerChevron--expanded']}`
              : styles.bannerChevron
          }
          aria-hidden="true"
        >
          &#x25BC;
        </span>
      </div>

      {expanded ? (
        <div id="cascade-banner-body" className={styles.bannerBody}>
          <WarningContent
            count={cascadeCheck.count}
            format={draft.format}
            illegalCardIds={cascadeCheck.illegalCardIds}
            onRemoveIllegal={onRemoveIllegal}
            textClassName={styles.bannerBodyText ?? ''}
          />
        </div>
      ) : null}
    </div>
  );
}

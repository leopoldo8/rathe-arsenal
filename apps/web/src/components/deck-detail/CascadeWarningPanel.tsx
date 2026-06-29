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
import { useTranslation } from 'react-i18next';
import type { ICompositionDraft } from '../../hooks/useCompositionDraft';
import {
  cascadeReasonLabel,
  type ICascadeCheckResult,
  type TCascadeReason,
} from '../../hooks/useCascadeCheck';
import styles from './CascadeWarningPanel.module.css';

// ---------------------------------------------------------------------------
// Shared sub-component: warning content
// ---------------------------------------------------------------------------

type TDraftCard = ICompositionDraft['cards'][number];

interface IWarningContentProps {
  readonly count: number;
  readonly format: string;
  readonly illegalCardIds: ReadonlySet<string>;
  readonly illegalCards: readonly TDraftCard[];
  readonly reasons: ReadonlyMap<string, TCascadeReason>;
  readonly onRemoveIllegal: (ids: ReadonlySet<string>) => void;
  readonly textClassName: string;
}

function WarningContent({
  count,
  format,
  illegalCardIds,
  illegalCards,
  reasons,
  onRemoveIllegal,
  textClassName,
}: IWarningContentProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <>
      {/* Format is intentionally NOT named here: a card can be illegal for the
          hero/class, not the format, so a blanket "illegal in {format}" would
          misattribute the reason. Per-card reasons appear in the list below. */}
      <p className={textClassName} data-testid="cascade-warning-text">
        {t('decks.illegalCardCount', { count })}
      </p>

      {illegalCards.length > 0 ? (
        <ul className={styles.illegalList} data-testid="cascade-illegal-list">
          {illegalCards.map((card) => {
            const reason = reasons.get(card.cardIdentifier);
            return (
              <li
                key={`${card.cardIdentifier}::${card.slot}`}
                className={styles.illegalItem}
                data-testid={`cascade-illegal-item-${card.cardIdentifier}`}
              >
                <span className={styles.illegalQty}>{card.quantity}&times;</span>
                <span className={styles.illegalName}>
                  <span className={styles.illegalNameText}>{card.name}</span>
                  {reason ? (
                    <span
                      className={styles.illegalReason}
                      data-testid={`cascade-reason-${card.cardIdentifier}`}
                    >
                      {cascadeReasonLabel(reason, format)}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={styles.removeOneBtn}
                  data-testid={`cascade-remove-${card.cardIdentifier}`}
                  aria-label={t('decks.removeCardFromDeckAria', { name: card.name })}
                  onClick={() => onRemoveIllegal(new Set([card.cardIdentifier]))}
                >
                  &#x2715;
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <button
        type="button"
        className={styles.removeBtn}
        data-testid="cascade-remove-illegal-btn"
        onClick={() => onRemoveIllegal(illegalCardIds)}
        aria-label={t('decks.removeIllegalCard', { count })}
      >
        {t('decks.removeIllegalCard', { count })}
      </button>
    </>
  );
}

/** Resolves the draft cards flagged illegal, in draft order. */
function selectIllegalCards(
  draft: ICompositionDraft,
  illegalCardIds: ReadonlySet<string>,
): readonly TDraftCard[] {
  return draft.cards.filter((c) => illegalCardIds.has(c.cardIdentifier));
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
  const { t } = useTranslation();
  if (cascadeCheck.count === 0) return null;

  return (
    <div
      className={styles.sidebarPanel}
      data-testid="cascade-warning-sidebar"
      role="status"
      aria-live="polite"
    >
      <h4 className={styles.sidebarTitle}>{t('decks.illegalCardsSidebarTitle')}</h4>
      <WarningContent
        count={cascadeCheck.count}
        format={draft.format}
        illegalCardIds={cascadeCheck.illegalCardIds}
        illegalCards={selectIllegalCards(draft, cascadeCheck.illegalCardIds)}
        reasons={cascadeCheck.reasons}
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
  const { t } = useTranslation();
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
          {t('decks.illegalCardCount', { count: cascadeCheck.count })}
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
            illegalCards={selectIllegalCards(draft, cascadeCheck.illegalCardIds)}
            reasons={cascadeCheck.reasons}
            onRemoveIllegal={onRemoveIllegal}
            textClassName={styles.bannerBodyText ?? ''}
          />
        </div>
      ) : null}
    </div>
  );
}

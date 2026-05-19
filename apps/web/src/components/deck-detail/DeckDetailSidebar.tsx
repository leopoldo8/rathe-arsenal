import React, { useState, useEffect } from 'react';
import { ShoppingPanel } from './ShoppingPanel';
import { SidebarCollapseToggle } from './SidebarCollapseToggle';
import { HeroDropdown } from './HeroDropdown';
import { FormatDropdown } from './FormatDropdown';
import { CascadeWarningPanelSidebar } from './CascadeWarningPanel';
import { LegalityBadge } from './LegalityBadge';
import type { TDeckStatus, IDeckLegality } from '../../api/decks';
import type { IShoppingLineResponse } from '../../api/shopping-line';
import type { TVariantFetchMutationStatus } from '../ShoppingLine';
import type { ICompositionDraft } from '../../hooks/useCompositionDraft';
import type { ICascadeCheckResult } from '../../hooks/useCascadeCheck';
import styles from './DeckDetailSidebar.module.css';

/** localStorage key for sidebar expanded/collapsed preference. */
const SIDEBAR_STORAGE_KEY = 'ra-deck-sidebar-expanded';

function readSidebarExpanded(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === null) return true; // default: expanded
    return raw === 'true';
  } catch {
    return true;
  }
}

function writeSidebarExpanded(value: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  } catch {
    // Storage write failure is non-fatal
  }
}

interface IDeckDetailSidebarProps {
  /**
   * Hero card identifier — used to look up the hero's catalog name and
   * display a thumbnail placeholder. Null for scratch decks.
   */
  readonly heroIdentifier: string | null;
  /**
   * Human-readable hero name (resolved by the API from heroIdentifier).
   * When null/undefined we fall back to the legacy `hero` string.
   */
  readonly heroName: string | null;
  /**
   * Legacy hero display string (from `deck.hero`). Used as a fallback
   * when heroName is null.
   */
  readonly heroLegacy: string;
  /** Deck format (e.g. "Classic Constructed"). */
  readonly format: string;
  /**
   * Legality assessment — the badge slot is rendered here; U14 fills the
   * visual badge. In U11 we render a slot element that U14 can replace.
   */
  readonly legality: IDeckLegality;
  /**
   * Fabrary ULID for imported decks; null for scratch decks.
   * The Fabrary link only renders when this is non-null.
   */
  readonly fabraryUlid: string | null;
  /**
   * Deck lifecycle status for the readiness block label context.
   */
  readonly status: TDeckStatus;
  /**
   * Readiness display values.
   */
  readonly effectivePercent: number;
  readonly rawPercent: number;
  readonly provisionedCards: number;
  readonly totalCards: number;
  /**
   * Shopping panel data + controls — forwarded to ShoppingPanel.
   */
  readonly shoppingData: IShoppingLineResponse | null;
  readonly onFetchVariants: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange: (startedAt: number | undefined) => void;
  readonly onShoppingRetry: () => void;

  // ---------------------------------------------------------------------------
  // U12 Edit-mode props
  // ---------------------------------------------------------------------------

  /**
   * Current render mode. 'edit' dims the readiness block and shows
   * the cascade warning panel + hero/format dropdowns (on desktop).
   */
  readonly mode?: 'view' | 'edit';
  /**
   * Current composition draft. Required when mode='edit'.
   */
  readonly compositionDraft?: ICompositionDraft;
  /**
   * Result from useCascadeCheck. Required when mode='edit'.
   */
  readonly cascadeCheck?: ICascadeCheckResult;
  /**
   * Called when the user clicks "Remove illegal cards".
   */
  readonly onRemoveIllegalCards?: (ids: ReadonlySet<string>) => void;
  /**
   * Called when the hero changes from the HeroDropdown (desktop Edit).
   */
  readonly onSetHero?: (heroIdentifier: string | null) => void;
  /**
   * Called when the format changes from the FormatDropdown (desktop Edit).
   */
  readonly onSetFormat?: (format: string) => void;
}

/**
 * DeckDetailSidebar — View-mode sidebar for the deck detail page (U11).
 *
 * Contains four blocks:
 *  1. Hero block — art thumbnail placeholder + hero name + format pill +
 *     legality badge slot (U14 fills the real badge).
 *  2. Readiness block — reuses the `.ra-readiness-display` treatment.
 *  3. Shopping summary line — mounts ShoppingPanel (inline on desktop,
 *     bottom sheet on mobile via the existing Dialog pattern in ShoppingPanel).
 *  4. Fabrary link — conditional on `fabraryUlid !== null`.
 *
 * Below 1280px the sidebar is a collapsible card rendered directly under the
 * header strip. The `ra-deck-sidebar-expanded` localStorage key persists the
 * expanded/collapsed state (default: true).
 */
export function DeckDetailSidebar({
  heroIdentifier,
  heroName,
  heroLegacy,
  format,
  legality,
  fabraryUlid,
  effectivePercent,
  rawPercent,
  provisionedCards,
  totalCards,
  shoppingData,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
  onShoppingRetry,
  mode = 'view',
  compositionDraft,
  cascadeCheck,
  onRemoveIllegalCards,
  onSetHero,
  onSetFormat,
}: IDeckDetailSidebarProps): React.ReactElement {
  const [expanded, setExpanded] = useState(readSidebarExpanded);

  function handleToggle(): void {
    const next = !expanded;
    setExpanded(next);
    writeSidebarExpanded(next);
  }

  // Persist any external change (e.g., SSR hydration mismatch guard)
  useEffect(() => {
    writeSidebarExpanded(expanded);
  }, [expanded]);

  const heroDisplayName = heroName ?? heroLegacy;
  const fabraryUrl = fabraryUlid ? `https://fabrary.com/decks/${fabraryUlid}` : null;

  const readinessClass = getReadinessClass(effectivePercent);

  return (
    <div
      className={styles.sidebar}
      data-testid="deck-detail-sidebar"
      data-expanded={expanded}
    >
      {/* Collapse toggle — only renders below 1280px via CSS */}
      <SidebarCollapseToggle expanded={expanded} onToggle={handleToggle} />

      {/* Sidebar body — hidden when collapsed (below 1280px) */}
      <div
        className={[styles.sidebarBody, expanded ? styles['sidebarBody--expanded'] : styles['sidebarBody--collapsed']].join(' ')}
        data-testid="deck-detail-sidebar-body"
        aria-hidden={!expanded}
      >
        {/* ---- Block 1: Hero ---- */}
        <section className={styles.block} aria-labelledby="sidebar-hero-title">
          {/* In Edit mode (desktop ≥1280px), show HeroDropdown + FormatDropdown.
              On mobile (<1280px) these render at the canvas top per R43. */}
          {mode === 'edit' && onSetHero !== undefined && onSetFormat !== undefined && compositionDraft !== undefined ? (
            <div className={styles.editHeroBlock} data-testid="sidebar-edit-hero-block">
              <HeroDropdown
                value={compositionDraft.heroIdentifier}
                onChange={onSetHero}
              />
              <FormatDropdown
                value={compositionDraft.format}
                onChange={onSetFormat}
              />
            </div>
          ) : (
            <div className={styles.heroBlock} data-testid="sidebar-hero-block">
              {/* Hero art thumbnail placeholder — the actual art is a CSS background
                  on the placeholder div. No <img> to avoid broken-image flicker when
                  heroIdentifier has no image in the catalog. */}
              <div
                className={styles.heroThumb}
                aria-label={heroDisplayName ? `Hero: ${heroDisplayName}` : 'Hero placeholder'}
                role="img"
                data-testid="sidebar-hero-thumb"
              >
                {/* Inner glyph placeholder */}
                <span className={styles.heroThumb__glyph} aria-hidden="true">
                  &#9670;
                </span>
              </div>

              <div className={styles.heroMeta}>
                <h2
                  id="sidebar-hero-title"
                  className={styles.heroName}
                  data-testid="sidebar-hero-name"
                >
                  {heroIdentifier ? heroDisplayName : heroDisplayName || 'No hero set'}
                </h2>
                <span className={styles.formatPill} data-testid="sidebar-format-pill">
                  {format}
                </span>

                {/* Legality badge — U14 mounts LegalityBadge here. */}
                <div
                  className={styles.legalitySlot}
                  data-testid="sidebar-legality-slot"
                  aria-label={`Legality: ${legality.category}`}
                >
                  <LegalityBadge legality={legality} format={format} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ---- Block 2: Readiness ----
            In Edit mode, dims with overlay scoped to this block ONLY.
            The overlay is position:absolute within the block container.
            Other sidebar blocks (cascade panel, shopping, fabrary) render
            at full opacity below this block. */}
        <section
          className={[styles.block, mode === 'edit' ? styles['block--dimmed'] : ''].filter(Boolean).join(' ')}
          aria-labelledby="sidebar-readiness-title"
          data-testid="sidebar-readiness-section"
        >
          {/* Dim overlay scoped to this block only when in Edit mode */}
          {mode === 'edit' && (
            <div className={styles.readinessDimOverlay} aria-hidden="true">
              <span className={styles.readinessDimLabel}>Will recompute on Save</span>
            </div>
          )}
          <h3 id="sidebar-readiness-title" className={styles.blockTitle}>
            Readiness
          </h3>
          <div className={styles.readinessBlock} data-testid="sidebar-readiness-block">
            {/* .ra-readiness-display is the reserved brass treatment for effectivePercent */}
            <div className={`ra-readiness-display ${styles.readinessDisplay} ${readinessClass}`}>
              <span className={styles.readinessDisplay__num}>
                {effectivePercent.toFixed(1)}
              </span>
              <span className={styles.readinessDisplay__sym}>%</span>
            </div>
            <div className={styles.readinessMeta}>
              <div className={styles.readinessMeta__label}>
                Effective Ready
                <span className={styles.readinessMeta__count}>
                  {' '}&middot;{' '}{provisionedCards}/{totalCards} cartas
                </span>
              </div>
              <div className={styles.readinessMeta__raw}>
                Raw {rawPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </section>

        {/* ---- Cascade Warning Panel — Edit mode only, desktop only (N > 0) ---- */}
        {mode === 'edit' &&
          cascadeCheck !== undefined &&
          compositionDraft !== undefined &&
          onRemoveIllegalCards !== undefined &&
          cascadeCheck.count > 0 && (
            <CascadeWarningPanelSidebar
              draft={compositionDraft}
              cascadeCheck={cascadeCheck}
              onRemoveIllegal={onRemoveIllegalCards}
            />
          )}

        {/* ---- Block 3: Shopping ---- */}
        <section
          className={styles.block}
          aria-labelledby="sidebar-shopping-title"
          data-testid="sidebar-shopping-block"
        >
          <h3 id="sidebar-shopping-title" className={styles.blockTitle}>
            Shopping
          </h3>
          <ShoppingPanel
            data={shoppingData}
            onFetchVariants={onFetchVariants}
            fetchMutationStatus={fetchMutationStatus}
            isCooldownActive={isCooldownActive}
            onPollingChange={onPollingChange}
            onRetry={onShoppingRetry}
          />
        </section>

        {/* ---- Block 4: Fabrary link — conditional ---- */}
        {fabraryUrl !== null && (
          <section className={styles.block} data-testid="sidebar-fabrary-block">
            <a
              href={fabraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fabraryLink}
              data-testid="sidebar-fabrary-link"
              aria-label="View deck on Fabrary (opens in new tab)"
            >
              View on Fabrary
              <span aria-hidden="true"> &#x2197;</span>
            </a>
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReadinessClass(percent: number): string {
  if (percent >= 80) return styles['readiness--high'] ?? '';
  if (percent >= 50) return styles['readiness--mid'] ?? '';
  return styles['readiness--low'] ?? '';
}

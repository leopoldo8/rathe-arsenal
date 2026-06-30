import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingPanel } from './ShoppingPanel';
import { SidebarCollapseToggle } from './SidebarCollapseToggle';
import { HeroDropdown } from './HeroDropdown';
import { FormatDropdown } from './FormatDropdown';
import { CascadeWarningPanelSidebar } from './CascadeWarningPanel';
import { LegalityBadge } from './LegalityBadge';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { useHeroesQuery } from '../../api/catalog';
import type { IDeckLegality } from '../../api/decks';
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
   * Current render mode. 'edit' shows the cascade warning panel +
   * hero/format dropdowns (on desktop).
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
 * Contains three blocks:
 *  1. Hero block — art thumbnail placeholder + hero name + format pill +
 *     legality badge slot (U14 fills the real badge).
 *  2. Shopping summary line — mounts ShoppingPanel (inline on desktop,
 *     bottom sheet on mobile via the existing Dialog pattern in ShoppingPanel).
 *  3. Fabrary link — conditional on `fabraryUlid !== null`.
 *
 * The readiness block (previously block 2) has been moved to ReadinessHero
 * in the canvas area per UXUI-14 (D1). The sidebar no longer renders readiness.
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
  const { t } = useTranslation();
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

  const fabraryUrl = fabraryUlid ? `https://fabrary.com/decks/${fabraryUlid}` : null;

  // Look up the hero card image so the sidebar can render the actual art
  // instead of a generic placeholder. The heroes query is shared with the
  // Edit-mode HeroDropdown (`HEROES_QUERY_KEY`) so this read is cache-hit
  // on every navigation after the first.
  const heroesQuery = useHeroesQuery();
  const heroCard = useMemo(
    () =>
      heroIdentifier
        ? heroesQuery.data?.heroes.find((h) => h.cardIdentifier === heroIdentifier) ?? null
        : null,
    [heroIdentifier, heroesQuery.data],
  );
  // Prefer the resolved hero card's name so the displayed name follows the
  // live `heroIdentifier` (which the route binds to the draft while editing),
  // falling back to the legacy display string for heroes not in the catalog.
  const heroDisplayName = heroCard?.name ?? heroName ?? heroLegacy;
  const heroImageUrl = heroCard?.imageUrl ?? null;
  const heroLightboxSources = heroImageUrl
    ? heroImageUrl.sources && heroImageUrl.sources.length > 0
      ? heroImageUrl.sources.map((s) => s.large)
      : [heroImageUrl.large]
    : [];
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);

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
              {/* Legality badge stays visible in Edit so the user can see the
                  status of the saved composition without leaving the canvas.
                  Reflects the last save — the in-progress cascade check sits
                  on the canvas as its own banner. */}
              <div
                className={styles.legalitySlot}
                data-testid="sidebar-edit-legality-slot"
                aria-label={`Legality: ${legality.category}`}
              >
                <LegalityBadge legality={legality} format={compositionDraft.format} />
              </div>
            </div>
          ) : (
            <div className={styles.heroBlock} data-testid="sidebar-hero-block">
              {/* Hero art thumbnail — pulls the real image from the heroes
                  catalog query when available, otherwise CardArt's SVG
                  fallback renders. Click opens the fullscreen lightbox. */}
              <div className={styles.heroThumb} data-testid="sidebar-hero-thumb">
                <CardArt
                  name={heroDisplayName ?? 'Hero'}
                  pitch={null}
                  cost={null}
                  type="Hero"
                  missing={false}
                  size="sm"
                  imageUrl={heroImageUrl}
                  onClick={
                    heroImageUrl
                      ? () => setHeroLightboxOpen(true)
                      : undefined
                  }
                />
              </div>

              <div className={styles.heroMeta}>
                <h2
                  id="sidebar-hero-title"
                  className={styles.heroName}
                  data-testid="sidebar-hero-name"
                >
                  {heroIdentifier ? heroDisplayName : heroDisplayName || t('decks.noHeroSet')}
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
            {t('decks.shopping')}
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
              aria-label={t('decks.viewOnFabraryAria')}
            >
              {t('decks.viewOnFabrary')}
              <span aria-hidden="true"> &#x2197;</span>
            </a>
          </section>
        )}
      </div>

      {heroLightboxOpen && heroImageUrl && (
        <CardLightbox
          imageUrl={heroImageUrl.large}
          sources={heroLightboxSources}
          name={heroDisplayName ?? 'Hero'}
          onClose={() => setHeroLightboxOpen(false)}
        />
      )}
    </div>
  );
}


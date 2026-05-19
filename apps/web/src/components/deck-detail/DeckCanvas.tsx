/**
 * DeckCanvas — single component with `mode: 'view' | 'edit'` prop (Key Technical Decisions).
 *
 * U11 ships the file with <ViewBody> implemented.
 * U12 will fill in <EditBody> and the mode dispatch.
 *
 * Shared helpers (slot grouping, section diamonds, slot icons) are defined
 * at file scope so both modes can reuse them without refactoring.
 *
 * NOTE: This file intentionally exports both components and helper functions/constants
 * (resolveSlotGroup, sumQuantities, groupBySlot, SlotIcon, SectionDiamond).
 * The react-refresh/only-export-components warning is suppressed because the plan
 * (Key Technical Decisions) requires shared helpers at file scope for U12 reuse.
 */
/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import { SubstitutionRow } from './SubstitutionRow';
import { MarkOwnedButton } from './MarkOwnedButton';
import { ModifiedViewBanner } from './ModifiedViewBanner';
import type { IBreakdown, IDecisionEntry, IBreakdownEntry } from '../../api/deck-detail';
import type { TDecisionState } from './SubstitutionRow';

// Import slot icons — vite-plugin-svgr `?react` suffix converts to React components
import SlotMainboardIcon from '../../assets/icons/slot-mainboard.svg?react';
import SlotHeroIcon from '../../assets/icons/slot-hero.svg?react';
import SlotWeaponIcon from '../../assets/icons/slot-weapon.svg?react';
import SlotEquipmentIcon from '../../assets/icons/slot-equipment.svg?react';
import styles from './DeckCanvas.module.css';

// ---------------------------------------------------------------------------
// Shared types / helpers — available to both ViewBody and EditBody (U12)
// ---------------------------------------------------------------------------

/**
 * Slot groups used for View mode section grouping (R35–R36).
 * The order here drives the display order within each section.
 */
export type TSlotGroup = 'mainboard' | 'hero' | 'weapon' | 'equipment' | 'other';

/**
 * Map a slot string to a TSlotGroup.
 * The `slot` value is the raw string from the API — normalise to lowercase.
 */
export function resolveSlotGroup(slot: string): TSlotGroup {
  const s = slot.toLowerCase();
  if (s.includes('hero')) return 'hero';
  if (s.includes('weapon')) return 'weapon';
  if (s.includes('equipment')) return 'equipment';
  if (
    s.includes('action') ||
    s.includes('attack') ||
    s.includes('reaction') ||
    s.includes('aura') ||
    s.includes('instant') ||
    s.includes('resource') ||
    s.includes('mentor') ||
    s.includes('token') ||
    s.includes('card') ||
    s === 'mainboard'
  ) {
    return 'mainboard';
  }
  return 'other';
}

/**
 * SlotIcon — renders the correct SVG slot icon based on the slot group.
 * Used in both View and Edit modes.
 */
export function SlotIcon({
  group,
  className,
}: {
  group: TSlotGroup;
  className?: string | undefined;
}): React.ReactElement {
  const iconProps = {
    className: className ?? styles.slotIcon,
    width: 14,
    height: 14,
    'aria-hidden': true as const,
  };
  switch (group) {
    case 'hero':
      return <SlotHeroIcon {...iconProps} />;
    case 'weapon':
      return <SlotWeaponIcon {...iconProps} />;
    case 'equipment':
      return <SlotEquipmentIcon {...iconProps} />;
    default:
      return <SlotMainboardIcon {...iconProps} />;
  }
}

/**
 * SectionDiamond — coloured diamond ornament preceding each section header.
 * Diamond colour semantics per R35:
 *  - exact: brass accent (positive)
 *  - swaps: mid-brass / info (neutral-positive)
 *  - not-owned: ready-low red (negative)
 */
export function SectionDiamond({
  variant,
}: {
  variant: 'exact' | 'swaps' | 'not-owned';
}): React.ReactElement {
  const cls = [
    styles.sectionDiamond,
    variant === 'swaps' ? styles['sectionDiamond--swaps'] : '',
    variant === 'not-owned' ? styles['sectionDiamond--notOwned'] : '',
  ]
    .filter(Boolean)
    .join(' ');
  return <div className={cls} aria-hidden="true" />;
}

/**
 * sumQuantities — sums the `quantity` field of an array of entries.
 * Shared by ViewBody and EditBody.
 */
export function sumQuantities(entries: readonly { readonly quantity: number }[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}

/**
 * resolveDecision — looks up the decision state for a substitute identifier.
 * Shared by ViewBody and EditBody.
 */
export function resolveDecision(
  decisions: readonly IDecisionEntry[],
  cardIdentifier: string,
): TDecisionState {
  const entry = decisions.find((d) => d.cardIdentifier === cardIdentifier);
  if (!entry) return 'pending';
  return entry.decision;
}

/**
 * groupBySlot — groups an array of IBreakdownEntry items by their TSlotGroup.
 * Returns an ordered Map so insertion order (mainboard → hero → weapon →
 * equipment → other) drives the display order.
 */
export function groupBySlot(
  entries: readonly IBreakdownEntry[],
): Map<TSlotGroup, IBreakdownEntry[]> {
  const ORDERED: TSlotGroup[] = ['mainboard', 'hero', 'weapon', 'equipment', 'other'];
  const map = new Map<TSlotGroup, IBreakdownEntry[]>(
    ORDERED.map((g) => [g, []]),
  );
  for (const entry of entries) {
    const group = resolveSlotGroup(entry.slot);
    map.get(group)!.push(entry);
  }
  return map;
}

// ---------------------------------------------------------------------------
// DeckCanvas public interface
// ---------------------------------------------------------------------------

interface IDeckCanvasProps {
  /**
   * Rendering mode.
   *  - 'view': renders ViewBody (U11 — fully implemented).
   *  - 'edit': renders EditBody (U12 — stub in U11).
   */
  readonly mode: 'view' | 'edit';

  // --- Data shared by both modes ---
  readonly breakdown: IBreakdown;
  readonly decisions: readonly IDecisionEntry[];
  readonly rejectedCount: number;

  // --- View-mode handlers ---
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onApproveSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly onRejectSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly onResetSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly pendingSubstituteId?: string | null;
  readonly onClearRejections: () => void;
  readonly isClearingRejections: boolean;
}

/**
 * DeckCanvas — the main content area of the deck detail page.
 *
 * Contains the three-section breakdown (Exact / Swaps / Not owned) in View
 * mode, and the editable grouped list in Edit mode (U12).
 *
 * The `mode` prop drives which body sub-component renders. Both sub-components
 * share the slot-grouping, section-diamond, and slot-icon helpers defined
 * above at file scope.
 */
export function DeckCanvas({
  mode,
  breakdown,
  decisions,
  rejectedCount,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onApproveSubstitute,
  onRejectSubstitute,
  onResetSubstitute,
  pendingSubstituteId = null,
  onClearRejections,
  isClearingRejections,
}: IDeckCanvasProps): React.ReactElement {
  if (mode === 'edit') {
    // U12 will implement EditBody. For U11 render a no-op stub.
    return <EditBody />;
  }

  return (
    <ViewBody
      breakdown={breakdown}
      decisions={decisions}
      rejectedCount={rejectedCount}
      onMarkOwned={onMarkOwned}
      isMarkingOwned={isMarkingOwned}
      pendingCard={pendingCard}
      onApproveSubstitute={onApproveSubstitute}
      onRejectSubstitute={onRejectSubstitute}
      onResetSubstitute={onResetSubstitute}
      pendingSubstituteId={pendingSubstituteId}
      onClearRejections={onClearRejections}
      isClearingRejections={isClearingRejections}
    />
  );
}

// ---------------------------------------------------------------------------
// EditBody — stub (U12 fills this in)
// ---------------------------------------------------------------------------

/**
 * EditBody — stub component for U11.
 * U12 will replace this with the full editable canvas.
 */
function EditBody(): React.ReactElement {
  return (
    <div className={styles.editStub} data-testid="deck-canvas-edit-stub" aria-busy="false">
      {/* U12 implements the editable canvas */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewBody — fully implemented in U11
// ---------------------------------------------------------------------------

interface IViewBodyProps {
  readonly breakdown: IBreakdown;
  readonly decisions: readonly IDecisionEntry[];
  readonly rejectedCount: number;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  readonly onApproveSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly onRejectSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly onResetSubstitute?: ((substituteIdentifier: string) => void) | undefined;
  readonly pendingSubstituteId?: string | null;
  readonly onClearRejections: () => void;
  readonly isClearingRejections: boolean;
}

/**
 * ViewBody — View mode canvas: three sections with diamond semantics (R35) +
 * slot icons (R36) + auto-collapsed resolved swaps (R37) + ModifiedViewBanner
 * promoted to canvas top (R38).
 */
function ViewBody({
  breakdown,
  decisions,
  rejectedCount,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onApproveSubstitute,
  onRejectSubstitute,
  onResetSubstitute,
  pendingSubstituteId = null,
  onClearRejections,
  isClearingRejections,
}: IViewBodyProps): React.ReactElement {
  const notOwned = breakdown.notOwned ?? breakdown.missing;

  // Single lightbox for exact and not-owned grids.
  // SubstitutionRow manages its own lightbox state per-row.
  const [lightbox, setLightbox] = React.useState<{
    readonly imageUrl: string;
    readonly sources: readonly string[];
    readonly name: string;
  } | null>(null);

  return (
    <div
      className={styles.canvas}
      data-testid="deck-canvas-view"
      id="deck-canvas"
    >
      {/* ModifiedViewBanner promoted to canvas top per R38 */}
      {rejectedCount > 0 && (
        <ModifiedViewBanner
          rejectedCount={rejectedCount}
          onClearRejections={onClearRejections}
          isClearing={isClearingRejections}
        />
      )}

      {/* ---- Section 1: Exact matches ---- */}
      <section className={styles.section} aria-labelledby="canvas-section-exact">
        <div className={styles.section__header}>
          <SectionDiamond variant="exact" />
          <h2 id="canvas-section-exact" className={styles.section__title}>
            Exact matches
          </h2>
          <span className={styles.section__count}>
            {sumQuantities(breakdown.exact)} cards
          </span>
        </div>

        {breakdown.exact.length === 0 ? (
          <p className={styles.section__empty}>No exact matches</p>
        ) : (
          <ExactMatchesGrid
            entries={breakdown.exact}
            onOpenLightbox={setLightbox}
          />
        )}
      </section>

      {/* ---- Section 2: Swaps ---- */}
      <section className={styles.section} aria-labelledby="canvas-section-swaps">
        <div className={styles.section__header}>
          <SectionDiamond variant="swaps" />
          <h2 id="canvas-section-swaps" className={styles.section__title}>
            Swaps
          </h2>
          <span className={styles.section__count}>
            {breakdown.substituted.length} active
          </span>
        </div>

        {breakdown.substituted.length === 0 ? (
          <p className={styles.section__empty}>No swaps needed</p>
        ) : (
          <ul className={styles.subList} aria-label="Swap proposals">
            {breakdown.substituted.map((entry) => {
              const subId = entry.match.substitute.cardIdentifier;
              const decision = resolveDecision(decisions, subId);
              return (
                <SubstitutionRow
                  key={`${entry.original.cardIdentifier}-${entry.original.slot}`}
                  original={entry.original}
                  match={entry.match}
                  decision={decision}
                  onApprove={onApproveSubstitute}
                  onReject={onRejectSubstitute}
                  onReset={onResetSubstitute}
                  isPending={pendingSubstituteId === subId}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Section 3: Not owned ---- */}
      <section className={styles.section} aria-labelledby="canvas-section-not-owned">
        <div className={styles.section__header}>
          <SectionDiamond variant="not-owned" />
          <h2 id="canvas-section-not-owned" className={styles.section__title}>
            Not owned
          </h2>
          <span className={styles.section__count}>
            {sumQuantities(notOwned)} cards
          </span>
        </div>

        {notOwned.length === 0 ? (
          <div className={styles.emptyAllPlayable}>
            <p className={styles.emptyAllPlayable__title}>
              All playable — no substitutions needed.
            </p>
            <p className={styles.emptyAllPlayable__sub}>
              Your collection covers every slot in this deck.
            </p>
          </div>
        ) : (
          <ul className={styles.missList} aria-label="Cards not in collection">
            {notOwned.map((entry) => {
              const slotGroup = resolveSlotGroup(entry.slot);
              return (
                <li
                  key={`${entry.cardIdentifier}-${entry.slot}`}
                  className={styles.missRow}
                >
                  {/* Slot icon per R36 */}
                  <SlotIcon group={slotGroup} className={styles.missRow__slotIcon} />
                  <CardArt
                    name={entry.name}
                    pitch={entry.pitch}
                    cost={entry.cost}
                    type={entry.type}
                    missing={true}
                    size="xs"
                    imageUrl={entry.imageUrl}
                    onClick={
                      entry.imageUrl
                        ? () =>
                            setLightbox({
                              imageUrl: entry.imageUrl!.large,
                              sources: lightboxSourcesFor(entry.imageUrl),
                              name: entry.name,
                            })
                        : undefined
                    }
                  />
                  <div className={styles.missRow__body}>
                    <div className={styles.missRow__name}>{entry.name}</div>
                    <div className={styles.missRow__meta}>{entry.slot}</div>
                  </div>
                  <span className={styles.missRow__qty}>
                    &#215;{entry.quantity}
                  </span>
                  <MarkOwnedButton
                    cardIdentifier={entry.cardIdentifier}
                    onMarkOwned={onMarkOwned}
                    isPending={isMarkingOwned}
                    pendingCard={pendingCard}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExactMatchesGrid — slot-grouped card grid for Exact section
// ---------------------------------------------------------------------------

interface IExactMatchesGridProps {
  readonly entries: readonly IBreakdownEntry[];
  readonly onOpenLightbox: (lightbox: {
    readonly imageUrl: string;
    readonly sources: readonly string[];
    readonly name: string;
  }) => void;
}

/**
 * ExactMatchesGrid — renders the exact matches grouped by slot.
 * Within each slot group a card art grid is shown.
 * Slot icons per R36 appear in the slot-group subheader.
 */
function ExactMatchesGrid({
  entries,
  onOpenLightbox,
}: IExactMatchesGridProps): React.ReactElement {
  const groups = groupBySlot(entries);

  return (
    <div className={styles.exactGrouped} data-testid="exact-matches-grid">
      {Array.from(groups.entries()).map(([group, groupEntries]) => {
        if (groupEntries.length === 0) return null;
        return (
          <div key={group} className={styles.slotGroup} data-testid={`slot-group-${group}`}>
            {/* Slot group subheader with icon */}
            <div className={styles.slotGroupHeader}>
              <SlotIcon group={group} />
              <span className={styles.slotGroupName}>{group}</span>
              <span className={styles.slotGroupCount}>
                {sumQuantities(groupEntries)}×
              </span>
            </div>

            <div className={styles.cardGrid}>
              {groupEntries.map((entry) => (
                <div
                  key={`${entry.cardIdentifier}-${entry.slot}`}
                  className={styles.cardCell}
                >
                  <CardArt
                    name={entry.name}
                    pitch={entry.pitch}
                    cost={entry.cost}
                    type={entry.type}
                    missing={false}
                    size="sm"
                    imageUrl={entry.imageUrl}
                    onClick={
                      entry.imageUrl
                        ? () =>
                            onOpenLightbox({
                              imageUrl: entry.imageUrl!.large,
                              sources: lightboxSourcesFor(entry.imageUrl),
                              name: entry.name,
                            })
                        : undefined
                    }
                  />
                  <span className={styles.cardCell__qty}>
                    &#215;{entry.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

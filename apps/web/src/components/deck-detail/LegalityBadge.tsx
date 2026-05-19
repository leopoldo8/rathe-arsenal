/**
 * LegalityBadge — three-state legality chip for the deck-detail sidebar.
 *
 * Variants:
 *  - `legal`      : Inert green `<span>` with aria-label. No popover, not focusable.
 *  - `incomplete` : Focusable `<button>` (neutral muted-brass border) that opens a
 *                   Radix Popover listing the engine's reasons[].
 *  - `illegal`    : Focusable `<button>` (red-muted border) that opens the same
 *                   Radix Popover with the full reasons list.
 *
 * Key technical decision: the `legal` branch MUST NOT be a button or carry
 * aria-haspopup because a popover that only says "legal" is empty content
 * that misleads keyboard users into expecting more. See U14 plan KTD.
 */
import React, { useRef } from 'react';
import { LegalityReasonsPopover } from './LegalityReasonsPopover';
import type { IDeckLegality } from '../../api/decks';
import styles from './LegalityBadge.module.css';

// ---------------------------------------------------------------------------
// Format abbreviations
// ---------------------------------------------------------------------------

const FORMAT_ABBREVS: Record<string, string> = {
  'Classic Constructed': 'CC',
  Blitz: 'Blitz',
  Draft: 'Draft',
  Sealed: 'Sealed',
};

function abbrevFormat(format: string): string {
  return FORMAT_ABBREVS[format] ?? format;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ILegalityBadgeProps {
  /** Engine legality result for this deck. */
  readonly legality: IDeckLegality;
  /** Deck format string (e.g. "Classic Constructed"). */
  readonly format: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders one of three visual variants based on `legality.category`.
 */
export function LegalityBadge({ legality, format }: ILegalityBadgeProps): React.ReactElement {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const abbrev = abbrevFormat(format);

  // ---- Legal: inert span, no popover, no focus ----
  if (legality.category === 'legal') {
    return (
      <span
        className={`${styles.badge} ${styles['badge--legal']}`}
        aria-label={`Deck is legal in ${format}`}
        data-testid="legality-badge"
        data-legality="legal"
      >
        <span className={styles.badgeIcon} aria-hidden="true">
          ✓
        </span>
        <span className={styles.badgeText}>Legal {abbrev}</span>
      </span>
    );
  }

  // ---- Incomplete or Illegal: interactive button with popover ----
  const isIncomplete = legality.category === 'incomplete';

  // Derive the chip label text
  const labelText = isIncomplete
    ? buildIncompleteLabel(legality.reasons)
    : buildIllegalLabel(legality.reasons);

  return (
    <LegalityReasonsPopover
      triggerRef={triggerRef}
      reasons={legality.reasons}
      category={legality.category}
      trigger={
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.badge} ${styles[isIncomplete ? 'badge--incomplete' : 'badge--illegal']}`}
          aria-haspopup="dialog"
          data-testid="legality-badge"
          data-legality={legality.category}
        >
          {!isIncomplete && (
            <span className={styles.badgeIcon} aria-hidden="true">
              ⚠
            </span>
          )}
          <span className={styles.badgeText}>{labelText}</span>
        </button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives the subtitle text for an incomplete deck from the first reason
 * or a structured "X/Y cards" pattern within the reasons array.
 */
function buildIncompleteLabel(reasons: readonly string[]): string {
  if (reasons.length === 0) return 'Incomplete';

  // Try to parse "X/Y cards" pattern from any reason
  for (const reason of reasons) {
    const match = reason.match(/(\d+)\/(\d+)/);
    if (match) {
      return `Incomplete · ${match[0]} cards`;
    }
  }

  return 'Incomplete';
}

/**
 * Derives the subtitle text for an illegal deck from the first reason.
 */
function buildIllegalLabel(reasons: readonly string[]): string {
  if (reasons.length === 0) return 'Illegal';

  // Take first reason, truncate to ~40 chars for the chip
  const first = reasons[0] ?? '';
  if (first.length <= 40) return `Illegal · ${first}`;
  return `Illegal · ${first.slice(0, 37)}…`;
}

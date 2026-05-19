/**
 * LegalityReasonsPopover — Radix Popover listing the engine's `reasons[]`.
 *
 * Used by LegalityBadge for the `incomplete` and `illegal` variants.
 *
 * A11y contract:
 *  - `role="dialog"`, `aria-modal="false"` (Tab does NOT trap).
 *  - `aria-labelledby` pointing at the popover heading.
 *  - Escape closes the popover.
 *  - `onCloseAutoFocus` returns focus to the trigger button explicitly,
 *    covering the keyboard-Escape, click-outside, and click-trigger-toggle
 *    paths uniformly.
 *  - Trigger must carry `aria-haspopup="dialog"` (set by the caller).
 */
import React, { useId } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { IDeckLegality } from '../../api/decks';
import styles from './LegalityReasonsPopover.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ILegalityReasonsPopoverProps {
  /** The trigger element (the badge button). */
  readonly trigger: React.ReactElement;
  /** Ref to the trigger button — used for explicit `onCloseAutoFocus`. */
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** The engine's reasons array. */
  readonly reasons: readonly string[];
  /** Legality category — drives the heading text. */
  readonly category: Exclude<IDeckLegality['category'], 'legal'>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FALLBACK_REASON = 'Deck is incomplete — reason not available.';

/**
 * Wraps the trigger in a Radix Popover. Popover body lists reasons[].
 */
export function LegalityReasonsPopover({
  trigger,
  triggerRef,
  reasons,
  category,
}: ILegalityReasonsPopoverProps): React.ReactElement {
  const headingId = useId();

  const headingText =
    category === 'incomplete' ? 'Deck is incomplete' : 'Deck is illegal in this format';

  const displayReasons = reasons.length > 0 ? reasons : [FALLBACK_REASON];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={styles.content}
          sideOffset={6}
          align="start"
          role="dialog"
          aria-modal={false}
          aria-labelledby={headingId}
          onCloseAutoFocus={(e) => {
            // Explicitly return focus to the trigger on all close paths
            // (Escape, click-outside, toggle). Radix's default behavior
            // handles this in most cases but we override to guarantee
            // parity across paths and prevent scroll-reset side-effects.
            e.preventDefault();
            triggerRef.current?.focus();
          }}
          data-testid="legality-reasons-popover"
        >
          <h4 id={headingId} className={styles.heading}>
            {headingText}
          </h4>

          <ul className={styles.reasonsList} role="list">
            {displayReasons.map((reason, i) => (
              // Reasons are engine-generated strings; using index as key is
              // acceptable here since the list is static within the popover.
              <li key={i} className={styles.reasonItem}>
                {reason}
              </li>
            ))}
          </ul>

          <Popover.Arrow className={styles.arrow} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

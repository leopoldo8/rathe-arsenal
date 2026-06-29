/**
 * CardRowLegalityWarning — edit-mode per-row warning icon with tooltip.
 *
 * Renders a small warning icon at the row's right edge when a card is
 * in the cascade-illegal set. A Radix Tooltip surfaces the per-card reason.
 *
 * A11y:
 *  - The warning trigger `<span>` carries `aria-label` so screen readers
 *    announce "Not legal in {format}" without needing to open the tooltip.
 *  - The tooltip element is linked to the trigger via `aria-describedby`
 *    so the row can reference the tooltip content.
 *  - Tooltip opens on focus + hover (Radix default); Escape dismisses.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './CardRowLegalityWarning.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ICardRowLegalityWarningProps {
  /** The deck format string (e.g. "Classic Constructed"). */
  readonly format: string;
  /**
   * The card identifier — used to build the tooltip element id for
   * aria-describedby on the trigger.
   */
  readonly cardIdentifier: string;
  /**
   * Optional per-card reason text from the cascade check.
   * Defaults to the localized "Card is not legal in {format}" when absent.
   */
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Warning icon + Radix Tooltip for a card that is illegal in the current
 * Edit-mode cascade check.
 */
export function CardRowLegalityWarning({
  format,
  cardIdentifier,
  reason,
}: ICardRowLegalityWarningProps): React.ReactElement {
  const { t } = useTranslation();
  const tooltipId = `card-legality-tooltip-${cardIdentifier}`;
  const tooltipText = reason ?? t('decks.cardNotLegalTooltip', { format });

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={styles.warningIcon}
            aria-label={t('decks.cardNotLegalAria', { format })}
            aria-describedby={tooltipId}
            role="img"
            tabIndex={0}
            data-testid={`card-legality-warning-${cardIdentifier}`}
          >
            ⚠
          </span>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            id={tooltipId}
            className={styles.tooltipContent}
            sideOffset={4}
            data-testid={`card-legality-tooltip-${cardIdentifier}`}
          >
            {tooltipText}
            <Tooltip.Arrow className={styles.tooltipArrow} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

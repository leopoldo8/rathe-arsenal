/**
 * EditableCardRow — single editable card row in the Edit mode canvas.
 *
 * Renders: slot icon | card name + meta | [− qty +] stepper | [× remove]
 *
 * Quantity reaching 0 triggers `onRemove` (auto-remove). The stepper
 * decrement is visually disabled at qty=1 to give user a confirmation
 * step before removing — decrement at qty=1 → qty=0 → auto-remove.
 */
import React from 'react';
import type { TDraftSlot } from '../../hooks/useCompositionDraft';
import { SlotIcon, type TSlotGroup } from './DeckCanvas';
import styles from './EditableCardRow.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IEditableCardRowProps {
  /** The card's catalog identifier. */
  readonly cardIdentifier: string;
  /** Human-readable card name. */
  readonly name: string;
  /** Current quantity in the draft. */
  readonly quantity: number;
  /** The deck slot this card occupies. */
  readonly slot: TDraftSlot;
  /** Card pitch (1=red, 2=yellow, 3=blue, null=colorless). */
  readonly pitch: number | null;
  /** Called with the new quantity when the stepper changes. */
  readonly onQuantityChange: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  /** Called when the remove button is pressed. */
  readonly onRemove: (cardIdentifier: string, slot: TDraftSlot) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EditableCardRow — single-card row with quantity stepper and remove button.
 */
export function EditableCardRow({
  cardIdentifier,
  name,
  quantity,
  slot,
  pitch,
  onQuantityChange,
  onRemove,
}: IEditableCardRowProps): React.ReactElement {
  function handleDecrement(): void {
    const next = quantity - 1;
    if (next <= 0) {
      onRemove(cardIdentifier, slot);
    } else {
      onQuantityChange(cardIdentifier, slot, next);
    }
  }

  function handleIncrement(): void {
    onQuantityChange(cardIdentifier, slot, quantity + 1);
  }

  const pitchLabel =
    pitch === 1
      ? 'red'
      : pitch === 2
        ? 'yellow'
        : pitch === 3
          ? 'blue'
          : null;

  // Map TDraftSlot to TSlotGroup for the icon (they are the same union)
  const slotGroup = slot as TSlotGroup;

  return (
    <li
      className={styles.row}
      data-testid={`editable-card-row-${cardIdentifier}`}
      data-slot={slot}
    >
      {/* Slot icon */}
      <SlotIcon group={slotGroup} className={styles.slotIcon} />

      {/* Card name + meta */}
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>{name}</div>
        {pitchLabel ? (
          <div className={styles.cardMeta} aria-label={`Pitch: ${pitchLabel}`}>
            {pitchLabel}
          </div>
        ) : null}
      </div>

      {/* Quantity stepper */}
      <div className={styles.stepper} role="group" aria-label={`Quantity for ${name}`}>
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={`Decrease quantity of ${name}`}
          data-testid={`decrement-${cardIdentifier}`}
          onClick={handleDecrement}
        >
          &minus;
        </button>
        <span className={styles.stepperQty} aria-live="polite" aria-atomic="true">
          {quantity}
        </span>
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={`Increase quantity of ${name}`}
          data-testid={`increment-${cardIdentifier}`}
          onClick={handleIncrement}
        >
          +
        </button>
      </div>

      {/* Remove button */}
      <button
        type="button"
        className={styles.removeBtn}
        aria-label={`Remove ${name} from deck`}
        data-testid={`remove-${cardIdentifier}`}
        onClick={() => onRemove(cardIdentifier, slot)}
      >
        <span aria-hidden="true">&#x2715;</span>
      </button>
    </li>
  );
}

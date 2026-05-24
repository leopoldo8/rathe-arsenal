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
import { CardArt } from '../card-art/CardArt';
import { CardRowLegalityWarning } from './CardRowLegalityWarning';
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
  /** Card type — drives the SVG fallback glyph when no image is available. */
  readonly type: string;
  /** Public image URLs (WebP small/large). null when the catalog has no image. */
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  /** Called with the new quantity when the stepper changes. */
  readonly onQuantityChange: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  /** Called when the remove button is pressed. */
  readonly onRemove: (cardIdentifier: string, slot: TDraftSlot) => void;
  /**
   * Set of card identifiers that are in the cascade-illegal set.
   * When this card's identifier is in the set, a warning icon is rendered
   * at the row's right edge. Optional — omit outside Edit mode.
   */
  readonly illegalCardIds?: ReadonlySet<string>;
  /**
   * Deck format string — forwarded to CardRowLegalityWarning for the
   * accessible aria-label and tooltip text.
   */
  readonly format?: string;
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
  type,
  imageUrl,
  onQuantityChange,
  onRemove,
  illegalCardIds,
  format,
}: IEditableCardRowProps): React.ReactElement {
  const isIllegal = illegalCardIds !== undefined && illegalCardIds.has(cardIdentifier);
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

  const cardArtPitch = (pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null) as
    | 1 | 2 | 3 | null;

  return (
    <li
      className={styles.row}
      data-testid={`editable-card-row-${cardIdentifier}`}
      data-slot={slot}
    >
      {/* Card thumbnail */}
      <div className={styles.thumb} aria-hidden="true">
        <CardArt
          name={name}
          pitch={cardArtPitch}
          cost={null}
          type={type}
          missing={false}
          size="xs"
          imageUrl={imageUrl}
        />
      </div>

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

      {/* Per-card legality warning icon (Edit mode, cascade-illegal) */}
      {isIllegal && format !== undefined && (
        <CardRowLegalityWarning
          format={format}
          cardIdentifier={cardIdentifier}
        />
      )}

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

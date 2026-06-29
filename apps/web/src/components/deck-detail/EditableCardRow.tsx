/**
 * EditableCardRow — Edit-mode gallery tile for a single card in a deck slot.
 *
 * Renders a vertical tile dominated by the card art (size=sm). Click the art
 * to open the shared CardLightbox at fullscreen. Below the art sit the name,
 * quantity stepper, and remove control.
 *
 * Quantity reaching 0 triggers `onRemove` (auto-remove). The stepper
 * decrement is visually disabled at qty=1 to give the user a confirmation
 * step before removing — decrement at qty=1 → qty=0 → auto-remove.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
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
  /** Card type — drives the SVG fallback glyph when no image is available. */
  readonly type: string;
  /**
   * Public image URLs (WebP small/large) plus optional `sources` fallback
   * list. CardArt cycles through `sources` on `<img>` `onError` so cards that
   * only ship foiled artwork (Armory Decks, judge promos) still render.
   */
  readonly imageUrl: {
    readonly small: string;
    readonly large: string;
    readonly sources?: readonly { readonly small: string; readonly large: string }[];
  } | null;
  /** Called with the new quantity when the stepper changes. */
  readonly onQuantityChange: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  /** Called when the remove button is pressed. */
  readonly onRemove: (cardIdentifier: string, slot: TDraftSlot) => void;
  /**
   * Called when the user clicks the card art. Parent owns the CardLightbox
   * state. Omit to make the art non-interactive.
   */
  readonly onOpenLightbox?: (args: {
    readonly imageUrl: string;
    readonly sources: readonly string[];
    readonly name: string;
  }) => void;
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

export function EditableCardRow({
  cardIdentifier,
  name,
  quantity,
  slot,
  type,
  imageUrl,
  onQuantityChange,
  onRemove,
  onOpenLightbox,
  illegalCardIds,
  format,
}: IEditableCardRowProps): React.ReactElement {
  const { t } = useTranslation();
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

  function handleArtClick(): void {
    if (!onOpenLightbox || !imageUrl) return;
    const sources =
      imageUrl.sources && imageUrl.sources.length > 0
        ? imageUrl.sources.map((s) => s.large)
        : [imageUrl.large];
    onOpenLightbox({
      imageUrl: imageUrl.large,
      sources,
      name,
    });
  }

  return (
    <li
      className={styles.tile}
      data-testid={`editable-card-row-${cardIdentifier}`}
      data-slot={slot}
    >
      {/* Card art — fills the top of the tile, clickable to open lightbox */}
      <div className={styles.art}>
        <CardArt
          name={name}
          pitch={null}
          cost={null}
          type={type}
          missing={false}
          size="md"
          imageUrl={imageUrl}
          onClick={onOpenLightbox && imageUrl ? handleArtClick : undefined}
        />
        {isIllegal && format !== undefined && (
          <div className={styles.warningOverlay}>
            <CardRowLegalityWarning
              format={format}
              cardIdentifier={cardIdentifier}
            />
          </div>
        )}
      </div>

      {/* Name */}
      <div className={styles.name} title={name}>
        {name}
      </div>

      {/* Quantity stepper + remove */}
      <div className={styles.controls}>
        <div className={styles.stepper} role="group" aria-label={t('decks.cardQuantityGroupAria', { name })}>
          <button
            type="button"
            className={styles.stepperBtn}
            aria-label={t('decks.decreaseQuantityAria', { name })}
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
            aria-label={t('decks.increaseQuantityAria', { name })}
            data-testid={`increment-${cardIdentifier}`}
            onClick={handleIncrement}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className={styles.removeBtn}
          aria-label={t('decks.removeCardAria', { name })}
          data-testid={`remove-${cardIdentifier}`}
          onClick={() => onRemove(cardIdentifier, slot)}
        >
          <span aria-hidden="true">&#x2715;</span>
        </button>
      </div>
    </li>
  );
}

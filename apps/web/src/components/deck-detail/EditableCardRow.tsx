/**
 * EditableCardRow — Edit-mode row for a single card in a deck slot: a thumbnail, the name with its
 * type and cost, the copy limit message, and the quantity stepper. Click the thumbnail to open the
 * shared CardLightbox at fullscreen.
 *
 * Two steppers, "No deck" and "No inventário" (door 3): the copies in the starting deck and the
 * copies carried outside it. A row leaves the draft only when both reach 0 (`onRemove`). When the
 * deck and the inventory together hold as many copies as the card may have, both "+" are disabled
 * with the reason, and a row over the limit says how many copies to take out. Tapping a quantity
 * offers to move one copy or all of them to the other side.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { TCopySide, TDraftSlot } from '../../hooks/useCompositionDraft';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import type { ICopyInfo, ICopySplit } from '../../lib/draft-legality';
import { cardTypeLabel } from './cardTypeLabel';
import { CardRowLegalityWarning } from './CardRowLegalityWarning';
import { RowMoveMenu } from './RowMoveMenu';
import styles from './EditableCardRow.module.css';

const ART_WIDTH_PX = 52;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IEditableCardRowProps {
  /** The card's catalog identifier. */
  readonly cardIdentifier: string;
  /** Human-readable card name. */
  readonly name: string;
  /** The card's pitch (1 to 3), null for a card with no pitch. */
  readonly pitch: number | null;
  /** Copies in the starting deck, in the draft. */
  readonly quantity: number;
  /** Copies carried outside the starting deck, in the draft. */
  readonly inventoryQuantity?: number;
  /** The deck slot this card occupies. */
  readonly slot: TDraftSlot;
  /** Card type — drives the SVG fallback glyph when no image is available. */
  readonly type: string;
  /** Resource cost, null for a card with none. */
  readonly cost?: number | null;
  /** Copies of this card in the whole deck against its limit; omit when the format has no rules. */
  readonly copies?: ICopyInfo | null;
  /** The same copies split into the starting deck and the inventory, for the lines that name both. */
  readonly copySplit?: ICopySplit | null;
  /** Deck format, named in the limit messages. */
  readonly formatName?: string;
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
  /** Called with the new inventory quantity when the inventory stepper changes. */
  readonly onInventoryQuantityChange?: ((cardIdentifier: string, slot: TDraftSlot, quantity: number) => void) | undefined;
  /** Called when the player moves `count` copies out of one side of the row. */
  readonly onMoveCopies?: ((cardIdentifier: string, slot: TDraftSlot, from: TCopySide, count: number) => void) | undefined;
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
  name: rawName,
  pitch,
  quantity,
  inventoryQuantity = 0,
  slot,
  type,
  cost = null,
  copies = null,
  copySplit = null,
  formatName = '',
  imageUrl,
  onQuantityChange,
  onInventoryQuantityChange,
  onMoveCopies,
  onRemove,
  onOpenLightbox,
  illegalCardIds,
  format,
}: IEditableCardRowProps): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(rawName, pitch, t);
  const isIllegal = illegalCardIds !== undefined && illegalCardIds.has(cardIdentifier);

  function handleDecrement(): void {
    const next = quantity - 1;
    if (next <= 0 && inventoryQuantity === 0) {
      onRemove(cardIdentifier, slot);
    } else {
      onQuantityChange(cardIdentifier, slot, next);
    }
  }

  function handleIncrement(): void {
    onQuantityChange(cardIdentifier, slot, quantity + 1);
  }

  function handleInventoryDecrement(): void {
    const next = inventoryQuantity - 1;
    if (next <= 0 && quantity === 0) {
      onRemove(cardIdentifier, slot);
    } else {
      onInventoryQuantityChange?.(cardIdentifier, slot, next);
    }
  }

  function handleInventoryIncrement(): void {
    onInventoryQuantityChange?.(cardIdentifier, slot, inventoryQuantity + 1);
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

  const atLimit = copies !== null && copies.total >= copies.limit;
  const overBy = copies !== null ? copies.total - copies.limit : 0;
  const reasonId = `copy-reason-${cardIdentifier}-${slot}`;
  const meta = cost === null ? cardTypeLabel(type, t) : t('deckDetail.rowTypeCost', { type: cardTypeLabel(type, t), cost });

  return (
    <li
      className={styles.tile}
      data-testid={`editable-card-row-${cardIdentifier}`}
      data-card-row={cardIdentifier}
      data-slot={slot}
      tabIndex={-1}
    >
      <div className={styles.art}>
        <CardArt
          name={name}
          pitch={null}
          cost={null}
          type={type}
          missing={false}
          size="sm"
          widthOverride={ART_WIDTH_PX}
          imageUrl={imageUrl}
          onClick={onOpenLightbox && imageUrl ? handleArtClick : undefined}
        />
        {isIllegal && format !== undefined && (
          <div className={styles.warningOverlay}>
            <CardRowLegalityWarning format={format} cardIdentifier={cardIdentifier} />
          </div>
        )}
      </div>

      <div className={styles.text}>
        <div className={styles.name} data-testid="row-name">{name}</div>
        <div className={styles.meta}>{meta}</div>
        {copies !== null && overBy > 0 && (
          <div className={styles.problem}>{overLimitLine(copies, copySplit, formatName, t)}</div>
        )}
        {copies !== null && atLimit && (
          <div id={reasonId} className={overBy > 0 ? styles.reason : styles.reasonHidden}>
            {limitReason(copies, copySplit, formatName, t)}
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.stepperCell} data-testid="stepper-deck" data-label={t('deckDetail.columnDeck')}>
          <div className={styles.stepper} role="group" aria-label={t('decks.cardQuantityGroupAria', { name })}>
            <button
              type="button"
              className={styles.stepperBtn}
              aria-label={t('decks.decreaseQuantityAria', { name })}
              data-testid={`decrement-${cardIdentifier}`}
              disabled={quantity === 0}
              onClick={handleDecrement}
            >
              &minus;
            </button>
            <QuantityValue
              side="deck"
              value={quantity}
              name={name}
              onMoveCopies={onMoveCopies && quantity > 0 ? (from, count) => onMoveCopies(cardIdentifier, slot, from, count) : undefined}
              cardIdentifier={cardIdentifier}
            />
            <button
              type="button"
              className={styles.stepperBtn}
              aria-label={t('decks.increaseQuantityAria', { name })}
              aria-describedby={atLimit ? reasonId : undefined}
              disabled={atLimit}
              data-testid={`increment-${cardIdentifier}`}
              onClick={handleIncrement}
            >
              +
            </button>
          </div>
        </div>

        <div className={styles.stepperCell} data-testid="stepper-inventory" data-label={t('deckDetail.columnInventory')}>
          <div className={styles.stepper} role="group" aria-label={t('deckDetail.inventoryGroupAria')}>
            <button
              type="button"
              className={styles.stepperBtn}
              aria-label={t('deckDetail.decreaseInventoryAria', { name })}
              data-testid={`decrement-inventory-${cardIdentifier}`}
              disabled={inventoryQuantity === 0}
              onClick={handleInventoryDecrement}
            >
              &minus;
            </button>
            <QuantityValue
              side="inventory"
              value={inventoryQuantity}
              name={name}
              onMoveCopies={
                onMoveCopies && inventoryQuantity > 0 ? (from, count) => onMoveCopies(cardIdentifier, slot, from, count) : undefined
              }
              cardIdentifier={cardIdentifier}
            />
            <button
              type="button"
              className={styles.stepperBtn}
              aria-label={t('deckDetail.increaseInventoryAria', { name })}
              aria-describedby={atLimit ? reasonId : undefined}
              disabled={atLimit}
              data-testid={`increment-inventory-${cardIdentifier}`}
              onClick={handleInventoryIncrement}
            >
              +
            </button>
          </div>
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

interface IQuantityValueProps {
  readonly side: TCopySide;
  readonly value: number;
  readonly name: string;
  readonly cardIdentifier: string;
  /** Present when the side holds copies the player may move; the number then opens the move menu. */
  readonly onMoveCopies: ((from: TCopySide, count: number) => void) | undefined;
}

function QuantityValue({ side, value, name, cardIdentifier, onMoveCopies }: IQuantityValueProps): React.ReactElement {
  const { t } = useTranslation();
  const number = (
    <span className={styles.stepperQty} data-testid={`quantity-${side}`} aria-live="polite" aria-atomic="true">
      {value}
    </span>
  );
  if (onMoveCopies === undefined) return number;

  const toInventory = side === 'deck';
  const choices = [
    { label: t(toInventory ? 'deckDetail.moveToInventoryOne' : 'deckDetail.moveToDeckOne'), count: 1 },
    { label: t(toInventory ? 'deckDetail.moveToInventoryAll' : 'deckDetail.moveToDeckAll', { count: value }), count: value },
  ];
  return (
    <RowMoveMenu
      label={t(toInventory ? 'deckDetail.moveFromDeckAria' : 'deckDetail.moveFromInventoryAria', { name })}
      testId={`move-from-${side}-${cardIdentifier}`}
      choices={choices}
      onPick={(count) => onMoveCopies(side, count)}
    >
      {number}
    </RowMoveMenu>
  );
}

function limitReason(copies: ICopyInfo, split: ICopySplit | null, format: string, t: TFunction): string {
  if (copies.kind === 'legendary') return t('deckDetail.rowMaxLegendary');
  if (copies.kind === 'restricted') return t('deckDetail.rowMaxRestricted', { format });
  if (split !== null && split.inventory > 0) return t('deckDetail.rowMaxFormatWithInventory', { limit: copies.limit, format });
  return t('deckDetail.rowMaxFormat', { limit: copies.limit, format });
}

function overLimitLine(copies: ICopyInfo, split: ICopySplit | null, format: string, t: TFunction): string {
  const params = { count: copies.total, limit: copies.limit, format, extra: copies.total - copies.limit };
  if (copies.kind === 'legendary') return t('deckDetail.rowCopiesOverLegendary', params);
  if (copies.kind === 'restricted') return t('deckDetail.rowCopiesOverRestricted', params);
  if (split !== null && split.inventory > 0) {
    return t('deckDetail.rowCopiesOverAcross', { ...params, deck: split.deck, inventory: split.inventory, total: copies.total });
  }
  return t('deckDetail.rowCopiesOver', params);
}

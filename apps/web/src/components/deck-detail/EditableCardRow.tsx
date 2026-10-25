/**
 * EditableCardRow — Edit-mode row for a single card in a deck slot: a thumbnail, the name with its
 * type and cost, the copy limit message, and the quantity stepper. Click the thumbnail to open the
 * shared CardLightbox at fullscreen.
 *
 * Quantity reaching 0 triggers `onRemove` (auto-remove): decrement at qty=1 removes the card.
 * When the deck holds as many copies as the card may have, "+" is disabled with the reason, and a
 * row over the limit says how many copies to take out.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { TDraftSlot } from '../../hooks/useCompositionDraft';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import type { ICopyInfo } from '../../lib/draft-legality';
import { cardTypeLabel } from './cardTypeLabel';
import { CardRowLegalityWarning } from './CardRowLegalityWarning';
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
  /** Current quantity in the draft. */
  readonly quantity: number;
  /** The deck slot this card occupies. */
  readonly slot: TDraftSlot;
  /** Card type — drives the SVG fallback glyph when no image is available. */
  readonly type: string;
  /** Resource cost, null for a card with none. */
  readonly cost?: number | null;
  /** Copies of this card in the whole deck against its limit; omit when the format has no rules. */
  readonly copies?: ICopyInfo | null;
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
  slot,
  type,
  cost = null,
  copies = null,
  formatName = '',
  imageUrl,
  onQuantityChange,
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
        <div className={styles.name}>{name}</div>
        <div className={styles.meta}>{meta}</div>
        {copies !== null && overBy > 0 && (
          <div className={styles.problem}>{overLimitLine(copies, formatName, t)}</div>
        )}
        {copies !== null && atLimit && (
          <div id={reasonId} className={overBy > 0 ? styles.reason : styles.reasonHidden}>
            {limitReason(copies, formatName, t)}
          </div>
        )}
      </div>

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
            aria-describedby={atLimit ? reasonId : undefined}
            disabled={atLimit}
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

function limitReason(copies: ICopyInfo, format: string, t: TFunction): string {
  if (copies.kind === 'legendary') return t('deckDetail.rowMaxLegendary');
  if (copies.kind === 'restricted') return t('deckDetail.rowMaxRestricted', { format });
  return t('deckDetail.rowMaxFormat', { limit: copies.limit, format });
}

function overLimitLine(copies: ICopyInfo, format: string, t: TFunction): string {
  const params = { count: copies.total, limit: copies.limit, format, extra: copies.total - copies.limit };
  if (copies.kind === 'legendary') return t('deckDetail.rowCopiesOverLegendary', params);
  if (copies.kind === 'restricted') return t('deckDetail.rowCopiesOverRestricted', params);
  return t('deckDetail.rowCopiesOver', params);
}

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import type { IDraftCard } from '../../hooks/useCompositionDraft';
import { cardTypeLabel } from './cardTypeLabel';
import styles from './LoadoutRow.module.css';

const ART_WIDTH_PX = 44;

interface ILoadoutRowProps {
  readonly card: IDraftCard;
  readonly onRemove: (cardIdentifier: string, slot: IDraftCard['slot']) => void;
  readonly onOpenLightbox: (args: { readonly imageUrl: string; readonly sources: readonly string[]; readonly name: string }) => void;
}

/** A hero, weapon or equipment row of the editor: the card and its type, with no quantity stepper. */
export function LoadoutRow({ card, onRemove, onOpenLightbox }: ILoadoutRowProps): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(card.name, card.pitch, t);
  const imageUrl = card.imageUrl;
  const isHero = card.slot === 'hero';
  const sources = imageUrl === null ? [] : imageUrl.sources?.map((source) => source.large) ?? [imageUrl.large];

  return (
    <li
      className={styles.row}
      data-testid={`loadout-row-${card.cardIdentifier}`}
      data-card-row={card.cardIdentifier}
      data-slot={card.slot}
      tabIndex={-1}
    >
      <CardArt
        name={name}
        pitch={null}
        cost={null}
        type={card.type}
        missing={false}
        size="xs"
        widthOverride={ART_WIDTH_PX}
        imageUrl={imageUrl}
        onClick={imageUrl === null ? undefined : () => onOpenLightbox({ imageUrl: imageUrl.large, sources, name })}
      />
      <div className={styles.text}>
        <div className={styles.name}>{isHero ? name : t('deckDetail.rowLoadoutQuantity', { count: card.quantity, name })}</div>
        <div className={styles.meta}>{cardTypeLabel(card.type, t)}</div>
      </div>
      {!isHero && (
        <button
          type="button"
          className={styles.removeBtn}
          aria-label={t('decks.removeCardAria', { name })}
          data-testid={`remove-${card.cardIdentifier}`}
          onClick={() => onRemove(card.cardIdentifier, card.slot)}
        >
          <span aria-hidden="true">&#x2715;</span>
        </button>
      )}
    </li>
  );
}

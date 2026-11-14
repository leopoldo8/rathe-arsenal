import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IScannedCard } from './collector-code';
import { cardName, pitchWord } from '../../lib/card-name';
import styles from './CardScanner.module.css';
import { ZoomableCardImage } from '../card-art/ZoomableCardImage';

const PITCH_CLASS: Readonly<Record<number, string | undefined>> = {
  1: styles.pitchRed,
  2: styles.pitchYellow,
  3: styles.pitchBlue,
};

interface ICardThumbProps {
  readonly card: IScannedCard;
  /** Opens the card full screen on click; off where the thumbnail sits inside a pick button. */
  readonly zoomable?: boolean;
}

export function CardThumb({ card, zoomable = false }: ICardThumbProps): React.ReactElement {
  const { t } = useTranslation();
  if (zoomable && card.imageSmall) {
    return <ZoomableCardImage image={card.imageSmall} name={cardName(card.name, card.pitch, t)} className={styles.thumb} />;
  }
  return card.imageSmall ? (
    <img src={card.imageSmall} alt="" className={styles.thumb} decoding="async" />
  ) : (
    <span className={styles.thumb} aria-hidden="true" />
  );
}

export function CardName({ card }: { readonly card: IScannedCard }): React.ReactElement {
  const { t } = useTranslation();
  const pitchClass = card.pitch === null ? undefined : PITCH_CLASS[card.pitch];
  return (
    <span className={styles.cardName}>
      {pitchClass && (
        <span
          className={`${styles.pitchDot} ${pitchClass}`}
          role="img"
          aria-label={t('decks.pitchAria', { pitch: pitchWord(card.pitch, t) ?? '' })}
          data-pitch={card.pitch}
        />
      )}
      {card.name}
    </span>
  );
}

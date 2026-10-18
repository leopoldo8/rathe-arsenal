import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard } from '../../api/shared-decks';
import { useImageFallback } from '../../hooks/useImageFallback';
import { imageSources } from '../deck-detail/recommendations/card-naming';
import styles from './SharedCardRow.module.css';

const PITCH_LABEL_KEY: Readonly<Record<number, string>> = {
  1: 'library.pitchRedLabel',
  2: 'library.pitchYellowLabel',
  3: 'library.pitchBlueLabel',
};

const PITCH_DOT_CLASS: Readonly<Record<number, string | undefined>> = {
  1: styles.pitchRed,
  2: styles.pitchYellow,
  3: styles.pitchBlue,
};

interface ISharedCardRowProps {
  readonly card: ISharedCard;
}

/** One compact row: thumbnail, pitch dot, name and quantity. */
export function SharedCardRow({ card }: ISharedCardRowProps): React.ReactElement {
  const { t } = useTranslation();
  const thumb = useImageFallback(imageSources(card.imageUrl, 'small'));
  const pitchKey = card.pitch === null ? undefined : PITCH_LABEL_KEY[card.pitch];

  return (
    <li className={styles.row} data-testid="shared-card-row">
      {thumb.src !== null ? (
        <img
          className={styles.thumb}
          src={thumb.src}
          alt={t('sharing.list.thumbAria', { name: card.name })}
          loading="lazy"
          onError={thumb.onError}
        />
      ) : (
        <span className={styles.thumbFallback} aria-hidden="true" />
      )}
      {card.pitch !== null && (
        <span className={`${styles.pitchDot} ${PITCH_DOT_CLASS[card.pitch] ?? ''}`} aria-hidden="true" />
      )}
      <span className={styles.name} title={card.name}>
        {card.name}
        {pitchKey !== undefined && <span className={styles.srOnly}> ({t(pitchKey)})</span>}
      </span>
      <span className={styles.quantity}>{t('sharing.list.quantity', { count: card.quantity })}</span>
    </li>
  );
}

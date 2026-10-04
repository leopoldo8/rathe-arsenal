import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IScannedCard } from './collector-code';
import styles from './CardScanner.module.css';

const PITCH_CLASS: Readonly<Record<number, string | undefined>> = {
  1: styles.pitchRed,
  2: styles.pitchYellow,
  3: styles.pitchBlue,
};

const PITCH_LABEL_KEY: Readonly<Record<number, string>> = {
  1: 'library.pitchRedLabel',
  2: 'library.pitchYellowLabel',
  3: 'library.pitchBlueLabel',
};

export function CardThumb({ card }: { readonly card: IScannedCard }): React.ReactElement {
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
          aria-label={t('decks.pitchAria', { pitch: t(PITCH_LABEL_KEY[card.pitch!]!) })}
          data-pitch={card.pitch}
        />
      )}
      {card.name}
    </span>
  );
}

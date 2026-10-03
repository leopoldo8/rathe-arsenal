import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DeckTile.module.css';

interface IUntrackPinProps {
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly deckName: string;
}

export function UntrackPin({
  onClick,
  disabled,
  deckName,
}: IUntrackPinProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.untrackPin}
      onClick={onClick}
      disabled={disabled}
      aria-label={t('home.untrackAriaLabel', { deckName })}
      aria-busy={disabled}
      title={t('home.untrackTitle')}
    >
      <svg className={styles.untrackPinIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 6 H 19" />
        <path d="M9 4 H 15 V 6" />
        <path d="M7 6 L 8 20 H 16 L 17 6" />
        <path d="M11 10 V 17 M 13 10 V 17" />
      </svg>
    </button>
  );
}

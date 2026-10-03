import React from 'react';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { TDeckStatus } from '../../api/decks';
import {
  ReadinessMedallion,
  type IHeroArt,
} from '../readiness-medallion/ReadinessMedallion';
import styles from './Deckbox.module.css';

interface IDeckboxFrontDeckProps {
  readonly deckName: string;
  readonly format: string;
  readonly status: TDeckStatus;
  readonly heroArt: IHeroArt | null;
  readonly readinessPct: number | null;
}

export function DeckboxFrontDeck({
  deckName,
  format,
  status,
  heroArt,
  readinessPct,
}: IDeckboxFrontDeckProps): React.ReactElement {
  const art = useImageFallback(heroArt?.smallSources ?? []);
  return (
    <div
      className={`${styles.face} ${styles.front}`}
      data-status={status}
      data-testid="deckbox-front-deck"
    >
      {art.src ? (
        <img
          className={styles.frontArt}
          src={art.src}
          alt=""
          aria-hidden="true"
          onError={art.onError}
        />
      ) : (
        <div className={`${styles.frontArt} ${styles.frontArtFallback}`} />
      )}
      <div className={styles.frontShade} />
      <span className={styles.monogram}>R</span>
      {readinessPct !== null && (
        <ReadinessMedallion
          className={styles.medallion}
          pct={readinessPct}
          size="sm"
          heroName=""
          heroArt={null}
          showArt={false}
        />
      )}
      <div className={styles.frontText}>
        <span className={styles.deckName}>{deckName}</span>
        <span className={styles.format}>{format}</span>
      </div>
    </div>
  );
}

export function DeckboxFrontBrand(): React.ReactElement {
  return (
    <div
      className={`${styles.face} ${styles.front} ${styles.frontBrand}`}
      data-testid="deckbox-front-brand"
    >
      <span className={styles.monogramBrand} data-testid="deckbox-monogram">
        R
      </span>
    </div>
  );
}

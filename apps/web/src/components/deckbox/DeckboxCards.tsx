import React from 'react';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { IHeroArt } from '../readiness-medallion/ReadinessMedallion';
import styles from './Deckbox.module.css';

export interface IDeckboxCardSlot {
  readonly cardIdentifier: string;
  readonly imageUrl: IHeroArt | null;
}

interface IDeckboxCardProps {
  readonly slot: IDeckboxCardSlot | null;
  readonly slotClass: string;
}

function DeckboxCard({ slot, slotClass }: IDeckboxCardProps): React.ReactElement {
  const image = useImageFallback(slot?.imageUrl?.smallSources ?? []);
  return (
    <div
      className={`${styles.card} ${slotClass}`}
      data-testid="deckbox-card"
      data-placeholder={image.src === null}
    >
      {image.src ? (
        <img
          className={styles.cardImage}
          src={image.src}
          alt=""
          aria-hidden="true"
          onError={image.onError}
        />
      ) : (
        <div className={styles.cardSilhouette} />
      )}
    </div>
  );
}

interface IDeckboxCardsProps {
  readonly cards: readonly (IDeckboxCardSlot | null)[];
}

/** Slots map by index (0 left, 1 centre, 2 right) but paint c1, c3, c2 so the centre card sits on top. */
export function DeckboxCards({ cards }: IDeckboxCardsProps): React.ReactElement {
  return (
    <>
      <DeckboxCard key="c1" slot={cards[0] ?? null} slotClass={styles.c1 ?? ''} />
      <DeckboxCard key="c3" slot={cards[2] ?? null} slotClass={styles.c3 ?? ''} />
      <DeckboxCard key="c2" slot={cards[1] ?? null} slotClass={styles.c2 ?? ''} />
    </>
  );
}

import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import type { IHeroArt } from '../readiness-medallion/ReadinessMedallion';
import { DeckboxScene } from './DeckboxScene';
import { DeckboxCards, type IDeckboxCardSlot } from './DeckboxCards';
import { DeckboxFrontBrand, DeckboxFrontDeck } from './DeckboxFronts';
import styles from './Deckbox.module.css';

export type { IDeckboxCardSlot };

interface IDeckboxDeckProps {
  readonly variant: 'deck';
  readonly deckId: number;
  readonly deckName: string;
  readonly format: string;
  readonly status: TDeckStatus;
  readonly heroArt: IHeroArt | null;
  readonly cards: readonly (IDeckboxCardSlot | null)[];
  readonly readinessPct: number | null;
  readonly className?: string | undefined;
}

interface IDeckboxBrandProps {
  readonly variant: 'brand';
  readonly className?: string | undefined;
}

export type IDeckboxProps = IDeckboxDeckProps | IDeckboxBrandProps;

function handleKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>): void {
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    event.currentTarget.click();
  }
}

function DeckboxScenes(props: IDeckboxProps): React.ReactElement {
  const showCards = props.variant === 'deck' && props.status !== 'idea';
  return (
    <>
      <DeckboxScene zIndex={1} className={styles.backScene}>
        <div className={`${styles.face} ${styles.back}`} />
        <div className={`${styles.face} ${styles.innerBack}`} data-testid="deckbox-interior" />
        <div className={`${styles.face} ${styles.innerLeft}`} />
        <div className={`${styles.face} ${styles.innerRight}`} />
        <div className={`${styles.face} ${styles.mouthFloor}`} />
        <div className={`${styles.face} ${styles.rim} ${styles.rimBack}`} data-testid="deckbox-rim" />
      </DeckboxScene>

      {showCards && (
        <DeckboxScene zIndex={2} className={styles.cardsScene}>
          <DeckboxCards cards={props.variant === 'deck' ? props.cards : []} />
        </DeckboxScene>
      )}

      <DeckboxScene zIndex={3} className={styles.frontScene}>
        <div className={`${styles.face} ${styles.left}`} />
        <div className={`${styles.face} ${styles.right}`} />
        <div className={`${styles.face} ${styles.rim} ${styles.rimLeft}`} data-testid="deckbox-rim" />
        <div className={`${styles.face} ${styles.rim} ${styles.rimRight}`} data-testid="deckbox-rim" />
        <div className={`${styles.face} ${styles.rim} ${styles.rimFront}`} data-testid="deckbox-rim" />
        {props.variant === 'deck' ? (
          <DeckboxFrontDeck
            deckName={props.deckName}
            format={props.format}
            status={props.status}
            heroArt={props.heroArt}
            readinessPct={props.readinessPct}
          />
        ) : (
          <DeckboxFrontBrand />
        )}
      </DeckboxScene>
    </>
  );
}

export function Deckbox(props: IDeckboxProps): React.ReactElement {
  const { t } = useTranslation();

  if (props.variant === 'brand') {
    const brandClass = [styles.deckbox, styles['deckbox--brand'], props.className]
      .filter(Boolean)
      .join(' ');
    return (
      <div
        className={brandClass}
        data-variant="brand"
        data-testid="deckbox"
        aria-hidden="true"
      >
        <DeckboxScenes {...props} />
      </div>
    );
  }

  const deckClass = [styles.deckbox, styles.link, props.className]
    .filter(Boolean)
    .join(' ');
  return (
    <Link
      to="/decks/$deckId"
      params={{ deckId: String(props.deckId) }}
      search={{ edit: undefined }}
      className={deckClass}
      aria-label={t('home.deckboxOpenAriaLabel', { deckName: props.deckName })}
      onKeyDown={handleKeyDown}
      data-variant="deck"
      data-testid="deckbox"
    >
      <DeckboxScenes {...props} />
    </Link>
  );
}

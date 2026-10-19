import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard, ISharedDeckResponse } from '../../api/shared-decks';
import { useImageFallback } from '../../hooks/useImageFallback';
import { imageSources } from '../deck-detail/recommendations/card-naming';
import styles from './SharedDeckHeader.module.css';

interface ISharedDeckHeaderProps {
  readonly deck: ISharedDeckResponse;
  /** WhatsApp pill shown beside the sharer's name (desktop); omitted when the link shows no contact. */
  readonly contact?: React.ReactNode;
}

function findHeroCard(cards: readonly ISharedCard[]): ISharedCard | undefined {
  return cards.find((card) => card.slot === 'hero');
}

export function SharedDeckHeader({ deck, contact }: ISharedDeckHeaderProps): React.ReactElement {
  const { t } = useTranslation();
  const heroCard = deck.heroCard ?? findHeroCard(deck.cards);
  const art = useImageFallback(imageSources(heroCard?.imageUrl ?? null, 'large'));

  return (
    <section className={styles.header} aria-labelledby="shared-deck-title" data-testid="shared-deck-header">
      {art.src !== null && (
        <div className={styles.backdrop} aria-hidden="true">
          <img className={styles.backdropImg} src={art.src} alt="" onError={art.onError} />
        </div>
      )}
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.content}>
        {art.src !== null && (
          <img
            className={styles.heroCard}
            src={art.src}
            alt={t('sharing.list.thumbAria', { name: deck.hero })}
            onError={art.onError}
          />
        )}
        <div className={styles.identity}>
          <p className={styles.eyebrow}>{t('sharing.page.eyebrow')}</p>
          <h1 id="shared-deck-title" className={styles.title}>
            {deck.name}
          </h1>
          <div className={styles.chips}>
            <span className={styles.chipAccent}>{deck.format}</span>
            <span className={styles.chip}>{t('sharing.page.heroLine', { hero: deck.hero })}</span>
            <span className={styles.chip}>{t('sharing.page.cardCount', { count: deck.totalCards })}</span>
          </div>
          <div className={styles.bylineRow}>
            <p className={styles.byline}>
              {t('sharing.page.bylinePrefix')} <b>{deck.sharerName}</b> · {t('sharing.page.bylineSuffix')}
            </p>
            {contact}
          </div>
        </div>
      </div>
    </section>
  );
}

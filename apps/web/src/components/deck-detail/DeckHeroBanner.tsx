import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { useImageFallback } from '../../hooks/useImageFallback';
import { ReadinessMedallion } from '../readiness-medallion/ReadinessMedallion';
import { DeckListActions } from './DeckListActions';
import { DeckNameInline } from './DeckNameInline';
import { DeckOverflowMenu } from './DeckOverflowMenu';
import { LegalityBadge } from './LegalityBadge';
import type { IDeckLegality } from '../../api/decks';
import { StatusDropdown } from './StatusDropdown';
import { STATUS_KEY_MAP } from './status-labels';
import { useDeckHero } from './useDeckHero';
import styles from './DeckHeroBanner.module.css';

interface IDeckHeroBannerProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly status: TDeckStatus;
  readonly format: string;
  readonly legality: IDeckLegality;
  readonly heroIdentifier: string | null;
  readonly heroFallbackName: string;
  readonly pct: number;
  readonly onEdit: () => void;
  readonly onShare: () => void;
  readonly onCopyList: () => void;
}

export function DeckHeroBanner({
  deckId,
  deckName,
  status,
  format,
  legality,
  heroIdentifier,
  heroFallbackName,
  pct,
  onEdit,
  onShare,
  onCopyList,
}: IDeckHeroBannerProps): React.ReactElement {
  const { t } = useTranslation();
  const hero = useDeckHero(heroIdentifier, heroFallbackName);
  const art = useImageFallback(hero.bannerSources);

  return (
    <section
      className={styles.banner}
      aria-label={t('deckDetail.bannerAria')}
      data-testid="deck-hero-banner"
    >
      <div className={styles.artFrame} aria-hidden="true" data-testid="deck-hero-banner-art-frame">
        {art.src ? (
          <img
            className={styles.art}
            src={art.src}
            alt=""
            onError={art.onError}
            data-testid="deck-hero-banner-art"
          />
        ) : (
          <div className={styles.artFallback} />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <Link
        to="/home"
        search={{ tag: [] }}
        className={styles.breadcrumb}
        aria-label={t('decks.backToDecksAria')}
      >
        {t('decks.backToDecksLabel')}
      </Link>

      <div className={styles.identity}>
        <div className={styles.title}>
          <DeckNameInline deckId={deckId} name={deckName} mode="view" />
        </div>
        <div className={styles.eyebrowRow}>
          <p className={styles.eyebrow} data-testid="deck-hero-eyebrow">
            {format}
          </p>
          {legality.category === 'illegal' ? (
            <>
              <span className={styles.verdictChip} data-testid="legality-badge" data-legality="illegal">
                {t('deckDetail.verdictBlocked', { format })}
              </span>
              <span className={styles.stageLine} data-testid="deck-stage-line">
                {t('deckDetail.stageLine', { stage: t(STATUS_KEY_MAP[status]) })}
              </span>
            </>
          ) : (
            legality.category !== 'legal' && <LegalityBadge legality={legality} format={format} />
          )}
        </div>
        <p className={styles.heroName} data-testid="deck-hero-name">
          {hero.name}
        </p>
      </div>

      <div className={styles.medallion}>
        <ReadinessMedallion pct={pct} size="lg" heroArt={hero.art} showArt={false} />
      </div>

      <div className={styles.actions} data-testid="deck-detail-action-bar">
        <StatusDropdown deckId={deckId} currentStatus={status} />
        <DeckListActions deckId={deckId} onCopyList={onCopyList} />
        <button type="button" className={styles.shareBtn} onClick={onShare} data-testid="deck-detail-share-btn">
          {t('sharing.dialog.trigger')}
        </button>
        <button
          type="button"
          className={styles.editBtn}
          aria-label={t('decks.editDeckAria')}
          data-testid="deck-detail-edit-btn"
          onClick={onEdit}
        >
          {t('decks.edit')}
        </button>
        <DeckOverflowMenu deckId={deckId} deckName={deckName} />
      </div>
    </section>
  );
}

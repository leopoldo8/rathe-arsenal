import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { useImageFallback } from '../../hooks/useImageFallback';
import { ReadinessMedallion } from '../readiness-medallion/ReadinessMedallion';
import { DeckNameInline } from './DeckNameInline';
import { DeckOverflowMenu } from './DeckOverflowMenu';
import { StatusDropdown } from './StatusDropdown';
import { useDeckHero } from './useDeckHero';
import styles from './DeckHeroBanner.module.css';

interface IDeckHeroBannerProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly status: TDeckStatus;
  readonly format: string;
  readonly leagueTag: string | null;
  readonly heroIdentifier: string | null;
  readonly heroFallbackName: string;
  readonly pct: number;
  readonly onEdit: () => void;
}

export function DeckHeroBanner({
  deckId,
  deckName,
  status,
  format,
  leagueTag,
  heroIdentifier,
  heroFallbackName,
  pct,
  onEdit,
}: IDeckHeroBannerProps): React.ReactElement {
  const { t } = useTranslation();
  const hero = useDeckHero(heroIdentifier, heroFallbackName);
  const art = useImageFallback(hero.bannerSources);
  const eyebrow = [format, leagueTag]
    .filter((part): part is string => part !== null && part !== '')
    .join(t('deckDetail.eyebrowSeparator'));

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

      <div className={styles.top}>
        <Link
          to="/home"
          search={{ tag: [] }}
          className={styles.breadcrumb}
          aria-label={t('decks.backToDecksAria')}
        >
          {t('decks.backToDecksLabel')}
        </Link>
        <div className={styles.actions} data-testid="deck-detail-action-bar">
          <StatusDropdown deckId={deckId} currentStatus={status} />
          <button
            type="button"
            className={styles.editBtn}
            aria-label={t('decks.editDeckAria')}
            data-testid="deck-detail-edit-btn"
            onClick={onEdit}
          >
            {t('decks.edit')}
          </button>
          <DeckOverflowMenu deckId={deckId} />
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.identity}>
          <p className={styles.eyebrow} data-testid="deck-hero-eyebrow">
            {eyebrow}
          </p>
          <div className={styles.title}>
            <DeckNameInline deckId={deckId} name={deckName} mode="view" />
          </div>
          <p className={styles.heroName} data-testid="deck-hero-name">
            {hero.name}
          </p>
        </div>
        <ReadinessMedallion pct={pct} size="lg" heroName={hero.name} heroArt={hero.art} showArt={false} />
      </div>
    </section>
  );
}

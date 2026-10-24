import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IRecommendationCard } from '../../../api/recommendations';
import { useImageFallback } from '../../../hooks/useImageFallback';
import { formatBrl } from '../../../utils/format-brl';
import { imageSources, type IRecommendationDeckCard } from './card-naming';
import { cardName } from '../../../lib/card-name';
import styles from './SwapCard.module.css';

/** `hidden` holds the card's place while it is being dealt; `reveal` plays its entrance once it has landed. */
export type TSwapCardEntrance = 'none' | 'hidden' | 'reveal';

interface ISwapCardProps {
  readonly recommendation: IRecommendationCard;
  readonly cutOptions: readonly IRecommendationDeckCard[];
  readonly busy: boolean;
  readonly dimmed: boolean;
  readonly entrance: TSwapCardEntrance;
  readonly onAdopt: (cutCardIdentifier: string) => void;
  readonly onDismiss: () => void;
  readonly onPreview: () => void;
}

function ArtImage({ sources, alt }: { readonly sources: readonly string[]; readonly alt: string }): React.ReactElement {
  const { src, onError } = useImageFallback(sources);
  return src === null ? (
    <span className={styles.artFallback}>{alt}</span>
  ) : (
    <img className={styles.artImage} src={src} alt={alt} onError={onError} draggable={false} />
  );
}

function CostChip({ recommendation, cut }: { readonly recommendation: IRecommendationCard; readonly cut: number | null }): React.ReactElement | null {
  const { t } = useTranslation();
  if (recommendation.cost === null) return null;
  const difference = cut === null ? null : recommendation.cost - cut;
  const label =
    difference === null
      ? t('recommendations.cost', { cost: recommendation.cost })
      : difference > 0
        ? t('recommendations.costMore', { count: difference })
        : difference < 0
          ? t('recommendations.costLess', { count: -difference })
          : t('recommendations.costSame');
  return (
    <span className={`${styles.chip} ${difference !== null && difference > 0 ? styles.chipCostUp : ''}`} data-testid="recommendation-cost">
      {label}
    </span>
  );
}

function OwnershipChip({ recommendation }: { readonly recommendation: IRecommendationCard }): React.ReactElement {
  const { t } = useTranslation();
  if (recommendation.freeCopies >= 1) {
    return (
      <span className={`${styles.chip} ${styles.chipOwned}`} data-testid="recommendation-owned">
        {t('recommendations.owned')}
      </span>
    );
  }
  if (recommendation.priceCents !== null && recommendation.productUrl !== null) {
    return (
      <a
        href={recommendation.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className={`${styles.chip} ${styles.chipPrice}`}
        aria-label={`${t('recommendations.buyAria', { name: recommendation.name })} ${formatBrl(recommendation.priceCents)}`}
      >
        {formatBrl(recommendation.priceCents)}
      </a>
    );
  }
  return (
    <span className={styles.chip} data-testid="recommendation-out-of-stock">
      {t('recommendations.outOfStock')}
    </span>
  );
}

export function SwapCard({
  recommendation,
  cutOptions,
  busy,
  dimmed,
  entrance,
  onAdopt,
  onDismiss,
  onPreview,
}: ISwapCardProps): React.ReactElement {
  const { t } = useTranslation();
  const selectId = useId();
  const [cut, setCut] = useState(recommendation.cutCardIdentifier ?? '');
  const isClear = recommendation.strength === 'clear_upgrade';
  const name = cardName(recommendation.name, recommendation.pitch, t);
  const chosenCut = cutOptions.find((option) => option.cardIdentifier === cut) ?? null;
  const cutCost = cut !== '' && cut === recommendation.cutCardIdentifier ? recommendation.cutCost : (chosenCut?.cost ?? null);
  const disabled = busy || dimmed;
  const className = [
    styles.card,
    isClear ? styles.clear : '',
    dimmed ? styles.dimmed : '',
    entrance === 'hidden' ? styles.hidden : '',
    entrance === 'reveal' ? styles.reveal : '',
  ].join(' ');

  return (
    <li
      className={className}
      data-testid="recommendation-row"
      data-card={recommendation.cardIdentifier}
      data-strength={recommendation.strength}
      data-dimmed={dimmed ? 'true' : 'false'}
    >
      <div className={styles.swap}>
        <button
          type="button"
          className={styles.art}
          data-testid="recommendation-art"
          data-deal-slot
          aria-label={t('recommendations.previewAria', { name })}
          onClick={onPreview}
        >
          <ArtImage sources={imageSources(recommendation.imageUrl, 'large')} alt={name} />
        </button>
        {chosenCut !== null && (
          <>
            <div className={styles.tucked} data-testid="recommendation-cut-art">
              <ArtImage sources={imageSources(chosenCut.imageUrl, 'small')} alt={cardName(chosenCut.name, chosenCut.pitch, t)} />
            </div>
            <span className={styles.outLabel}>{t('recommendations.outLabel')}</span>
          </>
        )}
      </div>
      <p className={`${styles.name} ${styles.detail}`} data-testid="recommendation-name">
        {name}
      </p>
      <div className={`${styles.chips} ${styles.detail}`}>
        {isClear ? (
          <span className={`${styles.chip} ${styles.chipClear}`} data-testid="clear-upgrade-badge">
            {t('recommendations.clearUpgrade')}
          </span>
        ) : (
          <span className={styles.chip} data-testid="recommendation-consider">
            {t('recommendations.consider')}
          </span>
        )}
        <CostChip recommendation={recommendation} cut={cutCost} />
        <OwnershipChip recommendation={recommendation} />
      </div>
      <p className={`${styles.reason} ${styles.detail}`}>{recommendation.reason}</p>
      <div className={`${styles.cutLine} ${styles.detail}`}>
        <label htmlFor={selectId}>{t('recommendations.cutIn')}</label>
        <select
          id={selectId}
          className={styles.cutSelect}
          value={cut}
          disabled={dimmed}
          onChange={(event) => setCut(event.currentTarget.value)}
          data-testid="recommendation-cut-select"
        >
          <option value="">{t('recommendations.cutNone')}</option>
          {cutOptions.map((option) => (
            <option key={option.cardIdentifier} value={option.cardIdentifier}>
              {cardName(option.name, option.pitch, t)}
            </option>
          ))}
        </select>
      </div>
      <div className={`${styles.actions} ${styles.detail}`}>
        <button
          type="button"
          className={styles.primary}
          disabled={disabled || cut === ''}
          aria-label={t('recommendations.adoptAria', { name: recommendation.name })}
          onClick={() => onAdopt(cut)}
        >
          {t('recommendations.adopt')}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={disabled}
          aria-label={t('recommendations.dismissAria', { name: recommendation.name })}
          onClick={onDismiss}
        >
          {t('recommendations.dismiss')}
        </button>
      </div>
    </li>
  );
}

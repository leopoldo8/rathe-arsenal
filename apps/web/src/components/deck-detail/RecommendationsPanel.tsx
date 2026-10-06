import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAdoptRecommendation,
  useDismissRecommendation,
  useGenerateRecommendations,
  useRecommendationsQuery,
  useUndismissRecommendation,
  type IRecommendationCard,
} from '../../api/recommendations';
import { formatBrl } from '../../utils/format-brl';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { CardArt } from '../card-art/CardArt';
import { useToast } from '../ui/Toast/useToast';
import styles from './RecommendationsPanel.module.css';

export interface IRecommendationDeckCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly slot: string;
}

interface IRecommendationsPanelProps {
  readonly deckId: number;
  readonly deckCards: readonly IRecommendationDeckCard[];
}

function toPitch(pitch: number | null): 1 | 2 | 3 | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

interface IRecommendationRowProps {
  readonly recommendation: IRecommendationCard;
  readonly cutOptions: readonly IRecommendationDeckCard[];
  readonly busy: boolean;
  readonly onAdopt: (cutCardIdentifier: string) => void;
  readonly onDismiss: () => void;
}

function RecommendationRow({
  recommendation,
  cutOptions,
  busy,
  onAdopt,
  onDismiss,
}: IRecommendationRowProps): React.ReactElement {
  const { t } = useTranslation();
  const selectId = useId();
  const [cut, setCut] = useState(recommendation.cutCardIdentifier ?? '');
  const isClear = recommendation.strength === 'clear_upgrade';
  const isOwned = recommendation.freeCopies >= 1;

  return (
    <li
      className={`${styles.row} ${isClear ? styles.rowClear : ''}`}
      data-testid="recommendation-row"
      data-card={recommendation.cardIdentifier}
      data-strength={recommendation.strength}
    >
      <span className={styles.art} data-testid="recommendation-art">
        <CardArt
          name={recommendation.name}
          pitch={toPitch(recommendation.pitch)}
          cost={null}
          type="Action"
          missing={false}
          size="xs"
          imageUrl={recommendation.imageUrl}
        />
      </span>
      <div className={styles.body}>
        <div className={styles.nameLine}>
          <span className={styles.name} data-testid="recommendation-name">
            {recommendation.name}
          </span>
          {isClear && (
            <span className={styles.badge} data-testid="clear-upgrade-badge">
              {t('recommendations.clearUpgrade')}
            </span>
          )}
          {isOwned ? (
            <span className={styles.owned} data-testid="recommendation-owned">
              {t('recommendations.owned')}
            </span>
          ) : recommendation.priceCents !== null && recommendation.productUrl !== null ? (
            <a
              href={recommendation.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className={styles.price}
              aria-label={`${t('recommendations.buyAria', { name: recommendation.name })} ${formatBrl(recommendation.priceCents)}`}
            >
              {formatBrl(recommendation.priceCents)}
            </a>
          ) : (
            <span className={styles.stock} data-testid="recommendation-out-of-stock">
              {t('recommendations.outOfStock')}
            </span>
          )}
        </div>
        <p className={styles.reason}>{recommendation.reason}</p>
        {recommendation.cutName !== null && (
          <p className={styles.cut} data-testid="recommendation-cut">
            {t('recommendations.replaces', { name: recommendation.cutName })}
          </p>
        )}
        <div className={styles.actions}>
          <label className={styles.cutLabel} htmlFor={selectId}>
            {t('recommendations.cutLabel')}
          </label>
          <select
            id={selectId}
            className={styles.cutSelect}
            value={cut}
            onChange={(event) => setCut(event.currentTarget.value)}
            data-testid="recommendation-cut-select"
          >
            <option value="">{t('recommendations.cutNone')}</option>
            {cutOptions.map((option) => (
              <option key={option.cardIdentifier} value={option.cardIdentifier}>
                {option.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || cut === ''}
            aria-label={t('recommendations.adoptAria', { name: recommendation.name })}
            onClick={() => onAdopt(cut)}
          >
            {t('recommendations.adopt')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            aria-label={t('recommendations.dismissAria', { name: recommendation.name })}
            onClick={onDismiss}
          >
            {t('recommendations.dismiss')}
          </button>
        </div>
      </div>
    </li>
  );
}

export function RecommendationsPanel({ deckId, deckCards }: IRecommendationsPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const query = useRecommendationsQuery(deckId);
  const generate = useGenerateRecommendations(deckId);
  const dismiss = useDismissRecommendation(deckId);
  const undismiss = useUndismissRecommendation(deckId);
  const adopt = useAdoptRecommendation(deckId);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const data = query.data;
  const isGenerating = generate.isPending || data?.pending === true;
  const listed = (data?.recommendations ?? []).filter((row) => !hidden.has(row.cardIdentifier));
  const busy = adopt.isPending || dismiss.isPending;

  function handleDismiss(recommendation: IRecommendationCard): void {
    setActionError(null);
    setHidden((current) => new Set([...current, recommendation.cardIdentifier]));
    dismiss.mutate(recommendation.cardIdentifier, {
      onSuccess: () =>
        show({
          kind: 'info',
          message: t('recommendations.dismissed', { name: recommendation.name }),
          action: {
            label: t('recommendations.undo'),
            onClick: () =>
              undismiss.mutate(recommendation.cardIdentifier, {
                onSuccess: () =>
                  setHidden((current) => new Set([...current].filter((id) => id !== recommendation.cardIdentifier))),
              }),
          },
        }),
      onError: (error) => {
        setHidden((current) => new Set([...current].filter((id) => id !== recommendation.cardIdentifier)));
        setActionError(localizeApiError(error, t));
      },
    });
  }

  function handleAdopt(recommendation: IRecommendationCard, cutCardIdentifier: string): void {
    setActionError(null);
    adopt.mutate(
      { recommendationId: recommendation.id, cutCardIdentifier, cutSlot: recommendation.slot },
      { onError: (error) => setActionError(localizeApiError(error, t)) },
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="deck-recommendations-title" data-testid="recommendations-panel">
      <div className={styles.header}>
        <h2 id="deck-recommendations-title" className={styles.title}>
          {t('recommendations.title')}
        </h2>
        <button
          type="button"
          className={styles.generate}
          disabled={isGenerating}
          aria-label={t('recommendations.generateAria')}
          onClick={() => {
            setActionError(null);
            generate.mutate(undefined, { onError: (error) => setActionError(localizeApiError(error, t)) });
          }}
          data-testid="recommendations-generate"
        >
          {t('recommendations.generate')}
        </button>
      </div>

      {data?.run?.stale === true && (
        <p className={styles.notice} data-testid="recommendations-stale">
          {t('recommendations.stale')}
        </p>
      )}
      {isGenerating && (
        <p role="status" className={styles.notice} data-testid="recommendations-generating">
          {t('recommendations.generating')}
        </p>
      )}
      {data?.failure && !isGenerating && (
        <p role="alert" className={styles.error} data-testid="recommendations-failure" data-code={data.failure.code}>
          {t(`recommendations.failure.${data.failure.code}`, { defaultValue: t('apiErrors.generic') })}
        </p>
      )}
      {actionError !== null && (
        <p role="alert" className={styles.error} data-testid="recommendations-action-error">
          {actionError}
        </p>
      )}
      {query.isError && (
        <div role="alert" className={styles.errorRow} data-testid="recommendations-load-error">
          <p className={styles.error}>{t('recommendations.loadError')}</p>
          <button type="button" className={styles.secondary} onClick={() => void query.refetch()}>
            {t('recommendations.retry')}
          </button>
        </div>
      )}

      {data && data.run === null && !isGenerating && (
        <p className={styles.empty} data-testid="recommendations-empty">
          {t('recommendations.empty')}
        </p>
      )}
      {data?.run && listed.length === 0 && (
        <p className={styles.empty} data-testid="recommendations-no-upgrades">
          {t('recommendations.noUpgrades')}
        </p>
      )}
      {listed.length > 0 && (
        <ul className={styles.list} aria-label={t('recommendations.listAria')}>
          {listed.map((recommendation) => (
            <RecommendationRow
              key={recommendation.id}
              recommendation={recommendation}
              cutOptions={deckCards.filter((card) => card.slot === recommendation.slot)}
              busy={busy}
              onAdopt={(cut) => handleAdopt(recommendation, cut)}
              onDismiss={() => handleDismiss(recommendation)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

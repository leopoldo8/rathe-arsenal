import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAdoptRecommendation,
  useDismissRecommendation,
  useGenerateRecommendations,
  useRecommendationsQuery,
  useUndismissRecommendation,
  type IGeneration,
  type IRecommendationCard,
} from '../../../api/recommendations';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { useWheelScrollsSideways } from '../../../hooks/useWheelScrollsSideways';
import { ApiError } from '../../../lib/api-client';
import { localizeApiError } from '../../card-scanner/localize-api-error';
import { CardLightbox } from '../../card-art/CardLightbox';
import { useToast } from '../../ui/Toast/useToast';
import { useAuth } from '../../../auth/useAuth';
import { DeckTutorTile } from './DeckTutorTile';
import { CandidatePile } from './CandidatePile';
import { imageSources, type IRecommendationDeckCard } from './card-naming';
import { cardName } from '../../../lib/card-name';
import { GenerationStatus } from './GenerationStatus';
import { SwapCard, type TSwapCardEntrance } from './SwapCard';
import { useDeal } from './useDeal';
import styles from './RecommendationsRail.module.css';

export const GENERATING_PLACEHOLDERS = 5;

interface IRecommendationsRailProps {
  readonly deckId: number;
  readonly deckCards: readonly IRecommendationDeckCard[];
  readonly heroName: string;
}

type TPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'generating'; readonly runBefore: string | null }
  | { readonly kind: 'dealing'; readonly runId: string };

function isCutGone(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  try {
    return (JSON.parse(error.message) as { code?: unknown }).code === 'NOTHING_TO_REPLACE';
  } catch {
    return false;
  }
}

export function RecommendationsRail({ deckId, deckCards, heroName }: IRecommendationsRailProps): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const { user } = useAuth();
  const chatAccess = user?.chatAccess === true;
  const reducedMotion = usePrefersReducedMotion();
  const query = useRecommendationsQuery(deckId);
  const generate = useGenerateRecommendations(deckId);
  const dismiss = useDismissRecommendation(deckId);
  const undismiss = useUndismissRecommendation(deckId);
  const adopt = useAdoptRecommendation(deckId);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<IRecommendationCard | null>(null);
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<TPhase>({ kind: 'idle' });
  const [pileGeneration, setPileGeneration] = useState<IGeneration | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const pileRef = useRef<HTMLDivElement | null>(null);
  const railRef = useWheelScrollsSideways<HTMLUListElement>();

  const data = query.data;
  const generation = data?.generation ?? null;
  const awaitingFirstPoll = requestedAt !== null && query.dataUpdatedAt < requestedAt;
  const isGenerating = generation !== null || awaitingFirstPoll;
  const runId = data?.run?.id ?? null;
  const listed = (data?.recommendations ?? []).filter((row) => !hidden.has(row.cardIdentifier));

  if (generation !== null && generation !== pileGeneration) setPileGeneration(generation);
  if (isGenerating && phase.kind !== 'generating') setPhase({ kind: 'generating', runBefore: runId });
  if (!isGenerating && phase.kind === 'generating') {
    const arrived = runId !== null && runId !== phase.runBefore && listed.length > 0 && !reducedMotion;
    setPhase(arrived ? { kind: 'dealing', runId } : { kind: 'idle' });
  }

  const dealing = phase.kind === 'dealing';
  const deal = useDeal({
    dealKey: dealing ? phase.runId : null,
    cards: listed.map((row) => ({ id: row.id, imageSrc: imageSources(row.imageUrl, 'large')[0] ?? null })),
    sectionRef,
    pileRef,
    classNames: {
      flying: styles.flying!,
      flip: styles.flyingFlip!,
      face: styles.flyingFace!,
      front: styles.flyingFront!,
      shadow: styles.flyingShadow!,
    },
    onDone: () => setPhase({ kind: 'idle' }),
  });

  const busy = adopt.isPending || dismiss.isPending;
  const showPile = isGenerating || dealing;
  const entranceOf = (id: string): TSwapCardEntrance => (dealing ? (deal.landed.has(id) ? 'reveal' : 'hidden') : 'none');

  function handleGenerate(): void {
    setActionError(null);
    setRequestedAt(Date.now());
    generate.mutate(undefined, {
      onError: (error) => {
        setRequestedAt(null);
        setActionError(localizeApiError(error, t));
      },
    });
  }

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
      { onError: (error) => setActionError(isCutGone(error) ? t('recommendations.cutGone') : localizeApiError(error, t)) },
    );
  }

  const generateLabel = isGenerating
    ? t('recommendations.generatingButton')
    : data?.run
      ? t('recommendations.generateAgain')
      : t('recommendations.generate');

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="deck-recommendations-title"
      data-testid="recommendations-panel"
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 id="deck-recommendations-title" className={styles.title}>
            {t('recommendations.title')}
          </h2>
          {isGenerating && (
            <GenerationStatus
              status={generation?.status ?? 'queued'}
              elapsedMs={generation?.elapsedMs ?? 0}
              measuredAt={generation !== null ? query.dataUpdatedAt : (requestedAt ?? Date.now())}
              typicalMs={generation?.typicalMs ?? null}
              poolSize={generation?.poolSize ?? null}
              heroName={heroName}
            />
          )}
        </div>
        <button
          type="button"
          className={styles.generate}
          disabled={isGenerating || generate.isPending}
          onClick={handleGenerate}
          data-testid="recommendations-generate"
        >
          {generateLabel}
        </button>
      </div>

      {data?.run?.stale === true && !isGenerating && (
        <p className={styles.notice} data-testid="recommendations-stale">
          {t('recommendations.stale')}
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
        <p className={styles.notice} data-testid="recommendations-empty">
          {t('recommendations.empty')}
        </p>
      )}
      {data?.run && listed.length === 0 && !isGenerating && !dealing && (
        <p className={styles.notice} data-testid="recommendations-no-upgrades">
          {t('recommendations.noUpgrades')}
        </p>
      )}

      {(chatAccess || showPile || listed.length > 0) && (
        <ul ref={railRef} className={styles.rail} aria-label={t('recommendations.listAria')} data-testid="recommendations-rail">
          {chatAccess && <DeckTutorTile deckId={deckId} heroName={heroName} />}
          {showPile && (
            <CandidatePile
              ref={pileRef}
              poolSize={pileGeneration?.poolSize ?? null}
              sample={pileGeneration?.poolSample ?? []}
              lifting={phase.kind === 'generating' && !reducedMotion}
              folding={deal.folding}
            />
          )}
          {listed.map((recommendation) => (
            <SwapCard
              key={recommendation.id}
              recommendation={recommendation}
              cutOptions={deckCards.filter((card) => card.slot === recommendation.slot)}
              busy={busy}
              dimmed={isGenerating}
              entrance={entranceOf(recommendation.id)}
              onAdopt={(cut) => handleAdopt(recommendation, cut)}
              onDismiss={() => handleDismiss(recommendation)}
              onPreview={() => setPreview(recommendation)}
            />
          ))}
          {isGenerating &&
            listed.length === 0 &&
            Array.from({ length: GENERATING_PLACEHOLDERS }, (_, index) => (
              <li key={index} className={styles.placeholder} data-testid="recommendations-placeholder">
                <span className={styles.placeholderArt} />
              </li>
            ))}
        </ul>
      )}

      {preview !== null && preview.imageUrl !== null && (
        <CardLightbox
          imageUrl={preview.imageUrl.large}
          sources={[preview.imageUrl.large, ...preview.imageUrl.sources.map((source) => source.large)]}
          name={cardName(preview.name, preview.pitch, t)}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

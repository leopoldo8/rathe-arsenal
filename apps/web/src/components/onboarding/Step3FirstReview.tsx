import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button/Button';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import { CardArt } from '../card-art/CardArt';
import { CongratsAllPlayable } from './CongratsAllPlayable';
import { formatSwapRationale } from '../../i18n/format-reasons';
import { useDecksQuery, ITrackedDeckListItem } from '../../api/decks';
import { useDeckDetailQuery, ISubstitutedEntry } from '../../api/deck-detail';
import { useUseSuggestions } from '../../api/replacements';
import { localizeApiError } from '../card-scanner/localize-api-error';
import { findSuggestions } from '../deck-detail/deckDetailModel';
import styles from './Step3FirstReview.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milliseconds to wait for substitution computation before showing fallback. */
const COMPUTATION_TIMEOUT_MS = 10_000;

/** Max number of suggestions to show in the onboarding preview. */
const MAX_PREVIEW_SUBS = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IStep3FirstReviewProps {
  /** IDs of all decks that were imported in step 1. */
  readonly importedDeckIds: ReadonlyArray<number>;
  readonly onComplete: () => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Step 3 of the onboarding wizard — the collection's first suggestions.
 *
 * Previews up to 3 suggestions of the first imported deck and offers to use them all at once.
 * When all decks have raw 100% readiness, renders <CongratsAllPlayable> instead.
 * After 10s without substitutions loading, shows a "Continue without review" fallback.
 */
export function Step3FirstReview({
  importedDeckIds,
  onComplete,
  onBack,
  onSkip,
}: IStep3FirstReviewProps): React.ReactElement {
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);
  const [useError, setUseError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the first imported deck for the detail query (step 3 shows cross-deck,
  // but for simplicity shows subs from the first deck for onboarding).
  // If there are no deck IDs, fall back gracefully.
  const firstDeckId = importedDeckIds[0];
  const deckIdStr = firstDeckId !== undefined ? String(firstDeckId) : '';

  const decksQuery = useDecksQuery();
  // Guard: deckIdStr should always be set when Step3 mounts (Step1 imports a deck first).
  // Fallback to '0' prevents an accidental fetch to the bare /decks/ endpoint if the
  // parent wizard somehow renders Step3 without completing Step1 first.
  const safeDeckIdStr = deckIdStr || '0';
  const deckDetailQuery = useDeckDetailQuery(safeDeckIdStr);
  const useSuggestions = useUseSuggestions(Number(safeDeckIdStr));

  const isLoading = decksQuery.isLoading || deckDetailQuery.isLoading;
  const snapshot = deckDetailQuery.data?.latestSnapshot;
  const suggestions: readonly ISubstitutedEntry[] = snapshot
    ? [...findSuggestions(snapshot.breakdown, deckDetailQuery.data?.replacements ?? []).values()]
    : [];
  const previewSubs = suggestions.slice(0, MAX_PREVIEW_SUBS);

  function handleUseAll(): void {
    setUseError(null);
    useSuggestions.mutate(undefined, {
      onSuccess: onComplete,
      onError: (error) => setUseError(localizeApiError(error, t)),
    });
  }

  // Determine if ALL imported decks are 100% ready (no substitutions needed).
  const trackedDecks: readonly ITrackedDeckListItem[] = decksQuery.data?.trackedDecks ?? [];
  const importedDecks = trackedDecks.filter((d) => importedDeckIds.includes(d.id));
  const allFullyReady =
    importedDecks.length > 0 &&
    importedDecks.every(
      (d) => d.latestSnapshot !== null && d.latestSnapshot.rawPercent >= 100,
    );

  // Start the 10s timeout when loading begins; clear when loaded.
  useEffect(() => {
    if (!isLoading) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
    }, COMPUTATION_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading]);

  // --- 100% readiness fallback ---
  if (!isLoading && allFullyReady) {
    return (
      <CongratsAllPlayable onComplete={onComplete} />
    );
  }

  // --- 10s timeout fallback ---
  if (isLoading && timedOut) {
    return (
      <div className={styles.step}>
        <div className={styles.eyebrow}>{t('onboarding.step3Eyebrow')}</div>
        <h1 className={styles.heading}>{t('onboarding.step3AlmostHeading')}</h1>
        <p className={styles.body}>{t('onboarding.step3AlmostBody')}</p>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onBack}>
            {t('onboarding.backButton')}
          </Button>
          <Button type="button" variant="primary" onClick={onComplete}>
            {t('onboarding.continueWithoutReview')}
          </Button>
        </div>
      </div>
    );
  }

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className={styles.step}>
        <div className={styles.eyebrow}>{t('onboarding.step3Eyebrow')}</div>
        <h1 className={styles.heading}>{t('onboarding.step3ComputingHeading')}</h1>
        <p className={styles.body}>{t('onboarding.step3ComputingBody')}</p>
        <ul className={styles.subList} aria-label={t('onboarding.loadingSubstitutionsLabel')}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={styles.subSkeleton}>
              <Skeleton height="80px" aria-label={t('onboarding.computingSubstitutionsAria')} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // --- No substitutions (but not 100% readiness) — edge case ---
  if (previewSubs.length === 0) {
    return (
      <div className={styles.step}>
        <div className={styles.eyebrow}>{t('onboarding.step3Eyebrow')}</div>
        <h1 className={styles.heading}>{t('onboarding.step3LookingGoodHeading')}</h1>
        <p className={styles.body}>{t('onboarding.step3LookingGoodBody')}</p>
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onBack}>
            {t('onboarding.backButton')}
          </Button>
          <div className={styles.actionsRight}>
            <Button type="button" variant="ghost" onClick={onSkip}>
              {t('onboarding.skipForNow')}
            </Button>
            <Button type="button" variant="primary" onClick={onComplete}>
              {t('onboarding.enterArmory')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Substitution review ---
  return (
    <div className={styles.step}>
      <div className={styles.eyebrow}>{t('onboarding.step3Eyebrow')}</div>
      <h1 className={styles.heading}>{t('onboarding.step3ReviewHeading')}</h1>
      <p className={styles.body}>{t('onboarding.step3ReviewBody')}</p>

      <ul className={styles.subList} aria-label={t('onboarding.substitutionPreviewsLabel')}>
        {previewSubs.map((sub) => (
          <SubstitutionPreviewRow key={`${sub.original.cardIdentifier}::${sub.original.slot}`} sub={sub} />
        ))}
      </ul>

      {useError !== null && (
        <p role="alert" className={styles.body}>
          {useError}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('onboarding.backButton')}
        </Button>
        <div className={styles.actionsRight}>
          <Button type="button" variant="ghost" onClick={onComplete}>
            {t('onboarding.notNow')}
          </Button>
          <Button type="button" variant="primary" onClick={handleUseAll} disabled={useSuggestions.isPending}>
            {t('onboarding.useSuggestions', { count: suggestions.length })}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubstitutionPreviewRow (internal)
// ---------------------------------------------------------------------------

interface ISubstitutionPreviewRowProps {
  readonly sub: ISubstitutedEntry;
}

function SubstitutionPreviewRow({ sub }: ISubstitutionPreviewRowProps): React.ReactElement {
  const { t } = useTranslation();
  const { original, match } = sub;
  return (
    <li className={styles.subRow}>
      <div className={styles.subCards}>
        <div className={styles.subCardSlot}>
          <CardArt
            name={original.name}
            pitch={original.pitch}
            cost={original.cost}
            type={original.type}
            missing
            size="sm"
          />
          <span className={styles.subCardLabel}>{original.name}</span>
        </div>
        <span className={styles.subArrow} aria-hidden="true">→</span>
        <div className={styles.subCardSlot}>
          <CardArt
            name={match.substitute.name}
            pitch={
              typeof match.substitute.pitch === 'number'
                ? (match.substitute.pitch as 1 | 2 | 3)
                : null
            }
            cost={null}
            type="attack"
            missing={false}
            size="sm"
          />
          <span className={styles.subCardLabel}>{match.substitute.name}</span>
        </div>
      </div>

      <p className={styles.subRationale}>{formatSwapRationale(match.rationaleDetail, match.rationale, t)}</p>
    </li>
  );
}

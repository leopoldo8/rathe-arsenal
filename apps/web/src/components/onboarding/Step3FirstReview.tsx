import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button/Button';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import { CardArt } from '../card-art/CardArt';
import { CongratsAllPlayable } from './CongratsAllPlayable';
import { formatSwapRationale } from '../../i18n/format-reasons';
import { useDecksQuery, ITrackedDeckListItem } from '../../api/decks';
import { useDeckDetailQuery, ISubstitutedEntry } from '../../api/deck-detail';
import { findSwap, selectDeckSwaps, useSwapMutation, useSwapsQuery } from '../../api/swaps';
import type { ISwapRow } from '../../api/swaps';
import styles from './Step3FirstReview.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milliseconds to wait for substitution computation before showing fallback. */
const COMPUTATION_TIMEOUT_MS = 10_000;

/** Max number of substitutions to show in the onboarding preview. */
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
 * Step 3 of the onboarding wizard — first substitution review.
 *
 * Shows up to 3 pending substitutions across imported decks.
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
  const swapsQuery = useSwapsQuery();
  const swapMutation = useSwapMutation();
  const deckSwaps = selectDeckSwaps(swapsQuery.data?.rows, Number(safeDeckIdStr));
  const refetchSwaps = swapsQuery.refetch;
  const snapshotComputedAt = deckDetailQuery.data?.latestSnapshot?.computedAt ?? null;
  // The suggestions are written while the snapshot is computed, so the swaps
  // list loaded earlier may not have them yet.
  useEffect(() => {
    if (snapshotComputedAt !== null) void refetchSwaps();
  }, [snapshotComputedAt, refetchSwaps]);

  const isLoading = decksQuery.isLoading || deckDetailQuery.isLoading;
  const snapshot = deckDetailQuery.data?.latestSnapshot;
  const substitutions: readonly ISubstitutedEntry[] = snapshot?.breakdown.substituted ?? [];
  const previewSubs = substitutions.slice(0, MAX_PREVIEW_SUBS);

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
          <SubstitutionPreviewRow
            key={sub.original.cardIdentifier}
            sub={sub}
            swap={
              findSwap(deckSwaps, {
                cardIdentifier: sub.original.cardIdentifier,
                slot: sub.original.slot,
                substituteIdentifier: sub.match.substitute.cardIdentifier,
              }) ?? null
            }
            onAct={(swapId, steps) => {
              void (async () => {
                for (const kind of steps) {
                  await swapMutation.mutateAsync({ swapId, action: { kind } });
                }
              })().catch(() => undefined);
            }}
          />
        ))}
      </ul>

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

// ---------------------------------------------------------------------------
// SubstitutionPreviewRow (internal)
// ---------------------------------------------------------------------------

type TPreviewAction = 'approve' | 'reject' | 'revert' | 'restore';

interface ISubstitutionPreviewRowProps {
  readonly sub: ISubstitutedEntry;
  readonly swap: ISwapRow | null;
  readonly onAct: (swapId: string, steps: readonly TPreviewAction[]) => void;
}

function SubstitutionPreviewRow({
  sub,
  swap,
  onAct,
}: ISubstitutionPreviewRowProps): React.ReactElement {
  const { t } = useTranslation();
  const { original, match } = sub;
  const [localDecision, setLocalDecision] = useState<'approved' | 'rejected' | null>(null);

  // Pressing the active button again takes the decision back, and switching
  // sides undoes the first decision before making the second, so the server
  // never holds a state the screen no longer shows.
  function handleApprove(): void {
    if (swap === null) return;
    const steps: TPreviewAction[] =
      localDecision === 'approved' ? ['revert'] : localDecision === 'rejected' ? ['restore', 'approve'] : ['approve'];
    setLocalDecision(localDecision === 'approved' ? null : 'approved');
    onAct(swap.id, steps);
  }

  function handleReject(): void {
    if (swap === null) return;
    const steps: TPreviewAction[] =
      localDecision === 'rejected' ? ['restore'] : localDecision === 'approved' ? ['revert', 'reject'] : ['reject'];
    setLocalDecision(localDecision === 'rejected' ? null : 'rejected');
    onAct(swap.id, steps);
  }

  const approveLabel = t('onboarding.approveSubAriaLabel', { substitute: match.substitute.name, original: original.slot });
  const rejectLabel = t('onboarding.rejectSubAriaLabel', { substitute: match.substitute.name, original: original.slot });

  return (
    <li className={styles.subRow}>
      <div className={styles.subCards}>
        <div className={styles.subCardSlot}>
          <CardArt
            name={original.slot}
            pitch={original.pitch}
            cost={original.cost}
            type={original.type}
            missing
            size="sm"
          />
          <span className={styles.subCardLabel}>{original.slot}</span>
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

      <div className={styles.subActions}>
        <Button
          type="button"
          variant={localDecision === 'approved' ? 'primary' : 'secondary'}
          size="sm"
          onClick={handleApprove}
          aria-label={approveLabel}
          aria-pressed={localDecision === 'approved'}
        >
          {t('onboarding.approveButton')}
        </Button>
        <Button
          type="button"
          variant={localDecision === 'rejected' ? 'danger' : 'secondary'}
          size="sm"
          onClick={handleReject}
          aria-label={rejectLabel}
          aria-pressed={localDecision === 'rejected'}
        >
          {t('onboarding.rejectButton')}
        </Button>
      </div>
    </li>
  );
}

import { useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  IBreakdown,
  useDeckDetailQuery,
  useMarkOwnedMutation,
} from '../../api/deck-detail';
import {
  useDecideSubstitutionMutation,
  useResetDecisionsMutation,
  useClearDeckRejectionsMutation,
} from '../../api/decisions';
import { useVariantFetchMutation } from '../../api/variant-fetch';
import { ReadinessHero } from '../../components/deck-detail/ReadinessHero';
import { BreakdownSections } from '../../components/deck-detail/BreakdownSections';
import { ModifiedViewBanner } from '../../components/deck-detail/ModifiedViewBanner';
import { ShoppingPanel } from '../../components/deck-detail/ShoppingPanel';
import styles from './decks.$deckId.module.css';

export const Route = createFileRoute('/_auth/decks/$deckId')({
  component: DeckDetailPage,
});

function countNotOwnedCards(breakdown: IBreakdown): number {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  return notOwned.reduce((sum, entry) => sum + entry.quantity, 0);
}

function DeckDetailPage(): React.ReactElement {
  const { deckId } = Route.useParams();

  // pollingStartedAt tracks when variant fetch polling began (epoch ms).
  // undefined means polling is inactive. Passed to useDeckDetailQuery to
  // enable dynamic refetchInterval and enforce the 5-minute safety timeout.
  const [pollingStartedAt, setPollingStartedAt] = useState<number | undefined>(
    undefined,
  );

  const detailQuery = useDeckDetailQuery(deckId, pollingStartedAt);
  const markOwnedMutation = useMarkOwnedMutation(deckId);
  const decideMutation = useDecideSubstitutionMutation(deckId);
  const resetDecisionMutation = useResetDecisionsMutation(deckId);
  const clearRejectionsMutation = useClearDeckRejectionsMutation(deckId);
  const variantFetchMutation = useVariantFetchMutation(deckId);

  // Stable callback passed to ShoppingPanel so that it can notify the page
  // when polling begins or ends. The page updates pollingStartedAt which
  // flows back into useDeckDetailQuery to control refetchInterval.
  const handlePollingChange = useCallback(
    (startedAt: number | undefined) => {
      setPollingStartedAt(startedAt);
    },
    [],
  );

  const handleFetchVariants = useCallback(() => {
    variantFetchMutation.mutate();
  }, [variantFetchMutation]);

  const isCooldownActive =
    variantFetchMutation.isSuccess &&
    variantFetchMutation.data?.status === 'already_fresh';

  if (detailQuery.isLoading) {
    return <p className={styles.loadingMsg}>Loading deck details...</p>;
  }

  if (detailQuery.isError) {
    return (
      <div>
        <p className={styles.errorMsg}>
          Failed to load deck: {(detailQuery.error as Error).message}
        </p>
        <button
          type="button"
          className={styles.retryBtn}
          onClick={() => void detailQuery.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const deck = detailQuery.data;

  if (!deck) {
    return <p className={styles.noSnapshotMsg}>Deck not found.</p>;
  }

  const snapshot = deck.latestSnapshot;

  function handleMarkOwned(cardIdentifier: string): void {
    markOwnedMutation.mutate(cardIdentifier);
  }

  function handleApproveSubstitute(substituteIdentifier: string): void {
    decideMutation.mutate({
      cardIdentifier: substituteIdentifier,
      decision: 'approved',
    });
  }

  function handleRejectSubstitute(substituteIdentifier: string): void {
    decideMutation.mutate({
      cardIdentifier: substituteIdentifier,
      decision: 'rejected',
    });
  }

  function handleResetSubstitute(substituteIdentifier: string): void {
    // Reset a single decision back to pending (deletes the row).
    // Uses DELETE /api/decks/:deckId/decisions/:cardIdentifier.
    // Unit 17 will add onMutate/onError optimistic rollback inside the hook.
    resetDecisionMutation.mutate(substituteIdentifier);
  }

  function handleClearRejections(): void {
    clearRejectionsMutation.mutate(undefined);
  }

  // The substitute identifier whose mutation is in flight (if any).
  // Covers both decide (approve/reject) and reset mutations.
  const pendingSubstituteId: string | null =
    decideMutation.isPending
      ? (decideMutation.variables?.cardIdentifier ?? null)
      : resetDecisionMutation.isPending
        ? (resetDecisionMutation.variables ?? null)
        : null;

  return (
    <div className={styles.page}>
      <Link to="/home" className={styles.backLink}>
        &#8592; Back to decks
      </Link>

      {!snapshot ? (
        <div>
          <h1>{deck.name}</h1>
          <p className={styles.noSnapshotMsg}>
            No readiness data yet. The snapshot will appear once computed.
          </p>
          <a
            href={`https://fabrary.com/decks/${deck.fabraryUlid}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Fabrary
          </a>
        </div>
      ) : (
        <>
          {/* Mutation error messages */}
          {decideMutation.isError && (
            <p className={styles.errorMsg}>
              Failed to update decision:{' '}
              {(decideMutation.error as Error).message}
            </p>
          )}
          {clearRejectionsMutation.isError && (
            <p className={styles.errorMsg}>
              Failed to clear rejections:{' '}
              {(clearRejectionsMutation.error as Error).message}
            </p>
          )}
          {markOwnedMutation.isError && (
            <p className={styles.errorMsg}>
              Failed to mark card:{' '}
              {(markOwnedMutation.error as Error).message}
            </p>
          )}

          {/* 3-column grid */}
          <div className={styles.layout}>
            {/* Column A — Readiness hero */}
            <div className={styles.colA}>
              <ReadinessHero
                effectivePercent={snapshot.effectivePercent}
                rawPercent={snapshot.rawPercent}
                fidelityPercent={snapshot.fidelityPercent}
                fabraryUlid={deck.fabraryUlid}
                deckName={deck.name}
                hero={deck.hero}
                format={deck.format}
              />
            </div>

            {/* Column B — Breakdown sections (substitutions, exact, not-owned) */}
            <div className={styles.colB}>
              {/* Modified view banner — appears when any decision='rejected' */}
              {deck.rejectedCount > 0 && (
                <ModifiedViewBanner
                  rejectedCount={deck.rejectedCount}
                  onClearRejections={handleClearRejections}
                  isClearing={clearRejectionsMutation.isPending}
                />
              )}

              {/* Path C banner */}
              {snapshot.path === 'C' && (
                <div role="status" className={styles.pathCBanner}>
                  <strong className={styles.pathCBanner__strong}>
                    Closest playable version.
                  </strong>{' '}
                  This deck is missing{' '}
                  {countNotOwnedCards(snapshot.breakdown)}{' '}
                  {countNotOwnedCards(snapshot.breakdown) === 1
                    ? 'card'
                    : 'cards'}
                  . You&rsquo;re currently at{' '}
                  {(Math.round(snapshot.fidelityPercent * 10) / 10).toFixed(1)}%
                  fidelity.
                </div>
              )}

              <BreakdownSections
                breakdown={snapshot.breakdown}
                decisions={deck.decisions}
                onMarkOwned={handleMarkOwned}
                isMarkingOwned={markOwnedMutation.isPending}
                pendingCard={
                  markOwnedMutation.isPending
                    ? (markOwnedMutation.variables ?? null)
                    : null
                }
                onApproveSubstitute={handleApproveSubstitute}
                onRejectSubstitute={handleRejectSubstitute}
                onResetSubstitute={handleResetSubstitute}
                pendingSubstituteId={pendingSubstituteId}
              />
            </div>

            {/* Column C — Shopping panel (desktop sticky aside + mobile sheet) */}
            <div className={styles.colC}>
              <ShoppingPanel
                data={deck.shoppingLine ?? null}
                onFetchVariants={handleFetchVariants}
                fetchMutationStatus={variantFetchMutation.status}
                isCooldownActive={isCooldownActive}
                onPollingChange={handlePollingChange}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

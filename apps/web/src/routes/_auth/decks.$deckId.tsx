import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  IBreakdown,
  useDeckDetailQuery,
  useMarkOwnedMutation,
} from '../../api/deck-detail';
import {
  useRejectSubstituteMutation,
  useResetRejectionsMutation,
} from '../../api/re-solve';
import { ReadinessHeader } from '../../components/readiness-header';
import { BreakdownList } from '../../components/breakdown-list';
import { ShoppingLine } from '../../components/ShoppingLine';

export const Route = createFileRoute('/_auth/decks/$deckId')({
  component: DeckDetailPage,
});

function countNotOwnedCards(breakdown: IBreakdown): number {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  return notOwned.reduce((sum, entry) => sum + entry.quantity, 0);
}

interface IPathCBannerProps {
  readonly fidelityPercent: number;
  readonly missingCardCount: number;
}

interface IModifiedViewBannerProps {
  readonly rejectionCount: number;
  readonly onReset: () => void;
  readonly isResetting: boolean;
}

function ModifiedViewBanner({
  rejectionCount,
  onReset,
  isResetting,
}: IModifiedViewBannerProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
        backgroundColor: '#fffbea',
        border: '1px solid #ecc94b',
        borderLeft: '4px solid #d69e2e',
        borderRadius: '4px',
        padding: '0.75rem 1rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        color: '#744210',
        fontSize: '0.875rem',
      }}
    >
      <div>
        <strong style={{ color: '#975a16' }}>Modified view.</strong> You have
        rejected {rejectionCount}{' '}
        {rejectionCount === 1 ? 'substitution' : 'substitutions'} for this
        deck.
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={isResetting}
        style={{
          padding: '0.375rem 0.75rem',
          borderRadius: '4px',
          border: '1px solid #d69e2e',
          backgroundColor: isResetting ? '#f7e9b7' : '#fefcbf',
          color: '#744210',
          cursor: isResetting ? 'not-allowed' : 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 500,
        }}
      >
        {isResetting ? 'Resetting...' : 'Reset all rejections'}
      </button>
    </div>
  );
}

function PathCBanner({
  fidelityPercent,
  missingCardCount,
}: IPathCBannerProps) {
  const displayFidelity = Math.round(fidelityPercent * 10) / 10;
  return (
    <div
      role="status"
      style={{
        backgroundColor: '#fffaf0',
        border: '1px solid #f6ad55',
        borderLeft: '4px solid #dd6b20',
        borderRadius: '4px',
        padding: '0.75rem 1rem',
        marginTop: '1rem',
        marginBottom: '1rem',
        color: '#7b341e',
        fontSize: '0.875rem',
      }}
    >
      <strong style={{ color: '#9c4221' }}>Closest playable version.</strong>{' '}
      This deck is missing {missingCardCount}{' '}
      {missingCardCount === 1 ? 'card' : 'cards'}. You&rsquo;re currently at{' '}
      {displayFidelity}% fidelity.
    </div>
  );
}

function DeckDetailPage() {
  const { deckId } = Route.useParams();
  const detailQuery = useDeckDetailQuery(deckId);
  const markOwnedMutation = useMarkOwnedMutation(deckId);
  const rejectMutation = useRejectSubstituteMutation(deckId);
  const resetMutation = useResetRejectionsMutation(deckId);
  const [curveWarnings, setCurveWarnings] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  if (detailQuery.isLoading) {
    return <p>Loading deck details...</p>;
  }

  if (detailQuery.isError) {
    return (
      <div style={{ color: '#e53e3e' }}>
        <p>Failed to load deck: {(detailQuery.error as Error).message}</p>
        <button
          onClick={() => detailQuery.refetch()}
          style={{ cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const deck = detailQuery.data;

  if (!deck) {
    return <p>Deck not found.</p>;
  }

  const snapshot = deck.latestSnapshot;

  function handleMarkOwned(cardIdentifier: string): void {
    markOwnedMutation.mutate(cardIdentifier);
  }

  function handleRejectSubstitute(substituteIdentifier: string): void {
    rejectMutation.mutate(substituteIdentifier, {
      onSuccess: (result) => {
        setCurveWarnings(new Set(result.curveWarnings));
      },
    });
  }

  function handleResetRejections(): void {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setCurveWarnings(new Set());
      },
    });
  }

  const pendingRejection = rejectMutation.isPending
    ? (rejectMutation.variables ?? null)
    : null;

  return (
    <section style={{ maxWidth: '720px' }}>
      <Link to="/home" style={{ color: '#3182ce', fontSize: '0.875rem' }}>
        &larr; Back to decks
      </Link>

      {snapshot ? (
        <>
          {deck.rejectionCount > 0 && (
            <ModifiedViewBanner
              rejectionCount={deck.rejectionCount}
              onReset={handleResetRejections}
              isResetting={resetMutation.isPending}
            />
          )}

          {snapshot.path === 'C' && (
            <PathCBanner
              fidelityPercent={snapshot.fidelityPercent}
              missingCardCount={countNotOwnedCards(snapshot.breakdown)}
            />
          )}

          {curveWarnings.size > 0 && (
            <div
              role="status"
              style={{
                backgroundColor: '#fefcbf',
                border: '1px solid #ecc94b',
                borderLeft: '4px solid #b7791f',
                borderRadius: '4px',
                padding: '0.75rem 1rem',
                marginTop: '1rem',
                marginBottom: '1rem',
                color: '#744210',
                fontSize: '0.875rem',
              }}
            >
              <strong>Pitch curve broken.</strong> Rejecting this swap broke
              the pitch curve and no alternative was found. Affected{' '}
              {curveWarnings.size === 1 ? 'card' : 'cards'}:{' '}
              {Array.from(curveWarnings).join(', ')}.
            </div>
          )}

          {rejectMutation.isError && (
            <div
              style={{
                color: '#e53e3e',
                backgroundColor: '#fff5f5',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              Failed to reject substitution:{' '}
              {(rejectMutation.error as Error).message}
            </div>
          )}

          {resetMutation.isError && (
            <div
              style={{
                color: '#e53e3e',
                backgroundColor: '#fff5f5',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              Failed to reset rejections:{' '}
              {(resetMutation.error as Error).message}
            </div>
          )}

          <ReadinessHeader
            effectivePercent={snapshot.effectivePercent}
            rawPercent={snapshot.rawPercent}
            fabraryUlid={deck.fabraryUlid}
            deckName={deck.name}
            hero={deck.hero}
            format={deck.format}
          />

          <ShoppingLine data={deck.shoppingLine ?? null} />

          {markOwnedMutation.isError && (
            <div
              style={{
                color: '#e53e3e',
                backgroundColor: '#fff5f5',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              Failed to mark card: {(markOwnedMutation.error as Error).message}
            </div>
          )}

          <BreakdownList
            breakdown={snapshot.breakdown}
            onMarkOwned={handleMarkOwned}
            isMarkingOwned={markOwnedMutation.isPending}
            pendingCard={
              markOwnedMutation.isPending
                ? (markOwnedMutation.variables ?? null)
                : null
            }
            onRejectSubstitute={handleRejectSubstitute}
            pendingRejection={pendingRejection}
            curveWarnings={curveWarnings}
          />
        </>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <h1 style={{ margin: '0 0 0.25rem' }}>{deck.name}</h1>
          <div
            style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}
          >
            {deck.hero} -- {deck.format}
          </div>
          <p style={{ color: '#999' }}>
            No readiness data yet. The snapshot will appear once computed.
          </p>
          <a
            href={`https://fabrary.com/decks/${deck.fabraryUlid}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3182ce', fontSize: '0.875rem' }}
          >
            View on Fabrary
          </a>
        </div>
      )}
    </section>
  );
}

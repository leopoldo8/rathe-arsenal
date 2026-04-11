import { createFileRoute, Link } from '@tanstack/react-router';
import {
  IBreakdown,
  useDeckDetailQuery,
  useMarkOwnedMutation,
} from '../../api/deck-detail';
import { ReadinessHeader } from '../../components/readiness-header';
import { BreakdownList } from '../../components/breakdown-list';

export const Route = createFileRoute('/_auth/decks/$deckId')({
  component: DeckDetailPage,
});

function countMissingCards(breakdown: IBreakdown): number {
  return breakdown.missing.reduce((sum, entry) => sum + entry.quantity, 0);
}

interface IPathCBannerProps {
  readonly fidelityPercent: number;
  readonly missingCardCount: number;
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

  return (
    <section style={{ maxWidth: '720px' }}>
      <Link to="/home" style={{ color: '#3182ce', fontSize: '0.875rem' }}>
        &larr; Back to decks
      </Link>

      {snapshot ? (
        <>
          {snapshot.path === 'C' && (
            <PathCBanner
              fidelityPercent={snapshot.fidelityPercent}
              missingCardCount={countMissingCards(snapshot.breakdown)}
            />
          )}

          <ReadinessHeader
            effectivePercent={snapshot.effectivePercent}
            rawPercent={snapshot.rawPercent}
            fabraryUlid={deck.fabraryUlid}
            deckName={deck.name}
            hero={deck.hero}
            format={deck.format}
          />

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

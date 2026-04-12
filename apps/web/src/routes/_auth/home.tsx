import { createFileRoute } from '@tanstack/react-router';
import { useDecksQuery, useUntrackDeckMutation, ITrackedDeckListResponse } from '../../api/decks';
import { TrackedDeckCard } from '../../components/tracked-deck-card';
import { EmptyHomeState } from '../../components/empty-home-state';
import { CardAutocomplete } from '../../components/card-autocomplete';
import { formatBrl } from '../../utils/format-brl';

export const Route = createFileRoute('/_auth/home')({
  component: HomePage,
});

/**
 * Home page (Phase 1a two-mode state machine).
 *
 * Modes:
 *  - Loading: skeleton matching the populated-mode layout (no flash of empty).
 *  - Error: inline error with a retry button wired to TanStack Query refetch.
 *  - Empty: `trackedDecks.length === 0`, regardless of `collectionCardCount`.
 *    Per the Phase 1a Scope Boundaries decision, fallback mode is collapsed
 *    into empty mode; the three-mode machine lands in Phase 1c.
 *  - Populated: existing deck list.
 *
 * Mode transitions happen naturally via TanStack Query invalidation of the
 * ['decks'] key from mutations (untrack, import, add-card).
 */
function HomePage() {
  const decksQuery = useDecksQuery();
  const untrackMutation = useUntrackDeckMutation();

  if (decksQuery.isLoading) {
    return <HomeSkeleton />;
  }

  if (decksQuery.isError) {
    return (
      <section
        role="alert"
        style={{
          maxWidth: '520px',
          padding: '1rem',
          border: '1px solid #feb2b2',
          borderRadius: '8px',
          background: '#fff5f5',
          color: '#9b2c2c',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Something went wrong loading your decks</h2>
        <p style={{ fontSize: '0.875rem' }}>
          {(decksQuery.error as Error).message}
        </p>
        <button
          type="button"
          onClick={() => decksQuery.refetch()}
          style={{
            cursor: 'pointer',
            padding: '0.5rem 0.875rem',
            border: '1px solid #9b2c2c',
            background: 'white',
            color: '#9b2c2c',
            borderRadius: '6px',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </section>
    );
  }

  const data = decksQuery.data;
  const trackedDecks = data?.trackedDecks ?? [];
  const collectionCardCount = data?.collectionCardCount ?? 0;

  if (trackedDecks.length === 0) {
    return <EmptyHomeState collectionCardCount={collectionCardCount} />;
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h1 style={{ margin: 0 }}>Your Decks</h1>
        {/* U6 creates `/import`. Plain anchor keeps typecheck green until then. */}
        <a href="/import">+ Import more</a>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {trackedDecks.map((deck) => (
          <TrackedDeckCard
            key={deck.id}
            deck={deck}
            onUntrack={(deckId) => untrackMutation.mutate(deckId)}
            isUntracking={
              untrackMutation.isPending &&
              untrackMutation.variables === deck.id
            }
          />
        ))}
      </div>
      <AggregateShoppingLine data={data} />

      <div style={{ marginTop: '2rem' }}>
        <CardAutocomplete label="Add more cards to your collection" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Aggregate shopping line callout (D6)
// ---------------------------------------------------------------------------

interface IAggregateShoppingLineProps {
  readonly data: ITrackedDeckListResponse | undefined;
}

/**
 * Renders a single-line aggregate callout below the deck list:
 * "R$ 312 completaria 4 de 6 decks na Cupula DT"
 *
 * Rules (D6):
 *  - Does not render when totalCostCents === 0
 *  - Does not render when no decks are tracked
 *  - Does not render when kind === 'unscraped'
 */
function AggregateShoppingLine({ data }: IAggregateShoppingLineProps) {
  const agg = data?.aggregateShoppingLine;

  if (!agg) return null;
  if (agg.kind === 'unscraped') return null;
  if (agg.totalCostCents === 0) return null;
  if (agg.completableDecks === 0) return null;

  return (
    <aside
      aria-label="Aggregate shopping line"
      style={{
        marginTop: '1.5rem',
        padding: '0.875rem 1rem',
        backgroundColor: '#ebf8ff',
        border: '1px solid #bee3f8',
        borderRadius: '6px',
        fontSize: '0.875rem',
        color: '#2a4365',
      }}
    >
      <strong>{formatBrl(agg.totalCostCents)}</strong> completaria{' '}
      <strong>{agg.completableDecks}</strong> de {agg.totalDecks} decks na{' '}
      {agg.storeName}
    </aside>
  );
}

/**
 * Loading skeleton that mirrors the populated-mode layout (3 stub deck cards).
 * This avoids a flash of empty-mode for users whose tracked decks are still
 * in-flight.
 */
function HomeSkeleton() {
  const stubs = [0, 1, 2] as const;
  return (
    <section aria-busy="true" aria-live="polite">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            width: '140px',
            height: '28px',
            borderRadius: '6px',
            background: '#edf2f7',
          }}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        {stubs.map((i) => (
          <div
            key={i}
            style={{
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background:
                'linear-gradient(90deg, #f7fafc 0%, #edf2f7 50%, #f7fafc 100%)',
              minHeight: '140px',
            }}
          >
            <div
              style={{
                width: '70%',
                height: '20px',
                borderRadius: '4px',
                background: '#e2e8f0',
              }}
            />
            <div
              style={{
                width: '50%',
                height: '14px',
                borderRadius: '4px',
                background: '#edf2f7',
              }}
            />
            <div
              style={{
                width: '40%',
                height: '24px',
                borderRadius: '4px',
                background: '#e2e8f0',
                marginTop: '0.5rem',
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

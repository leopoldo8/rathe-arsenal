interface IEmptyHomeStateProps {
  readonly collectionCardCount: number;
}

/**
 * Home page empty state (Phase 1a two-mode state machine).
 *
 * Rendered when the user has zero tracked decks. Per the Phase 1a Scope
 * Boundaries decision, fallback mode is collapsed into empty mode: users with
 * collection cards but no tracked decks see the same empty state as brand-new
 * users. The three-mode state machine (empty / fallback / populated) lands in
 * Phase 1c when Discover data makes fallback mode meaningful.
 *
 * The "Browse Discover -- coming soon" affordance is intentionally a muted
 * label, not a disabled button, to avoid the misleading click target.
 */
export function EmptyHomeState({ collectionCardCount }: IEmptyHomeStateProps) {
  return (
    <section style={{ maxWidth: '520px' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Welcome to Rathe Arsenal</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Track a deck to see how ready your collection is to build it. Paste a
        Fabrary URL and we will compute readiness, suggest substitutions, and
        highlight the cards you still need.
      </p>
      {collectionCardCount > 0 ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          You already have {collectionCardCount} card
          {collectionCardCount === 1 ? '' : 's'} in your collection.
        </p>
      ) : null}
      <div style={{ marginTop: '1.25rem' }}>
        {/*
          U6 creates the `/import` route. Until then this link 404s, which is
          acceptable per the Phase 1a plan. A plain anchor is used instead of
          TanStack Router's typed <Link> to keep typecheck green before U6
          lands -- the route tree does not yet know about `/import`.
        */}
        <a
          href="/import"
          style={{
            display: 'inline-block',
            padding: '0.625rem 1rem',
            background: '#2b6cb0',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Import a Fabrary deck
        </a>
      </div>
      <p
        style={{
          marginTop: '1rem',
          color: '#999',
          fontSize: '0.875rem',
          fontStyle: 'italic',
        }}
        aria-label="Discover feature coming soon"
      >
        Browse Discover -- coming soon
      </p>
      {/* U4: CardAutocomplete mounts here (below the primary CTA in both modes) */}
    </section>
  );
}

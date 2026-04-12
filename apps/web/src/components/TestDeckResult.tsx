import { Link } from '@tanstack/react-router';
import { IBreakdown } from '../api/deck-detail';
import { ITestDeckResponse } from '../api/test-deck';
import { BreakdownList } from './breakdown-list';
import { PathCResult } from './path-c-result';
import { ShoppingLine } from './ShoppingLine';

interface ITestDeckResultProps {
  readonly result: ITestDeckResponse;
  /**
   * Fires when the user clicks "Track this deck". The parent should
   * call the import mutation with `seedInventory: false`.
   */
  readonly onTrack: () => void;
  /**
   * Fires when the user clicks "Track + add cards to collection".
   * The parent should call the import mutation with `seedInventory: true`.
   */
  readonly onTrackAndSeed: () => void;
  readonly isTracking: boolean;
}

/**
 * Renders the result of `POST /api/decks/test`. Mirrors the deck detail
 * page layout so users get a familiar readiness header, breakdown, and
 * substitution list -- except that nothing has been persisted yet.
 *
 * The CTAs branch on `result.alreadyTracked`:
 *  - false: "Track this deck" (no inventory) and "Track + add cards"
 *  - true: a callout with a Go-to-deck link, no track buttons
 *
 * Path C results delegate to the shared `PathCResult` component from
 * Unit 8, which already owns the fidelity header and missing-cards
 * list. Path A/B render the standard breakdown inline.
 */
export function TestDeckResult({
  result,
  onTrack,
  onTrackAndSeed,
  isTracking,
}: ITestDeckResultProps) {
  const breakdown: IBreakdown = result.breakdown as unknown as IBreakdown;
  const displayEffective = Math.round(result.effectivePercent * 10) / 10;
  const displayRaw = Math.round(result.rawPercent * 10) / 10;

  return (
    <section
      aria-label="Test deck result"
      style={{
        marginTop: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <h2 style={{ margin: 0 }}>{result.name}</h2>
          <PathBadge path={result.path} />
        </div>
        <div style={{ color: '#666', fontSize: '0.875rem' }}>
          {result.hero} &mdash; {result.format}
        </div>
      </header>

      {result.path === 'C' ? (
        <PathCResult
          breakdown={breakdown}
          fidelityPercent={result.fidelityPercent}
          onTrackProximalVersion={onTrack}
          shoppingLine={result.shoppingLine}
        />
      ) : (
        <>
          <div
            role="status"
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '6px',
              background: '#ebf8ff',
              border: '1px solid #bee3f8',
              color: '#2c5282',
            }}
          >
            <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
              {displayEffective}%
            </div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Effective readiness ({displayRaw}% exact)
            </div>
          </div>

          <BreakdownList
            breakdown={breakdown}
            onMarkOwned={() => undefined}
            isMarkingOwned={false}
            pendingCard={null}
          />
        </>
      )}

      <ShoppingLine data={result.shoppingLine ?? null} />

      {result.alreadyTracked && result.trackedDeckId !== null ? (
        <AlreadyTrackedCallout trackedDeckId={result.trackedDeckId} />
      ) : (
        <TrackActions
          onTrack={onTrack}
          onTrackAndSeed={onTrackAndSeed}
          isTracking={isTracking}
        />
      )}
    </section>
  );
}

function PathBadge({ path }: { readonly path: 'A' | 'B' | 'C' }) {
  const colors: Record<'A' | 'B' | 'C', { bg: string; fg: string; border: string }> = {
    A: { bg: '#c6f6d5', fg: '#22543d', border: '#9ae6b4' },
    B: { bg: '#bee3f8', fg: '#2a4365', border: '#90cdf4' },
    C: { bg: '#fed7d7', fg: '#742a2a', border: '#feb2b2' },
  };
  const c = colors[path];
  return (
    <span
      aria-label={`Path ${path}`}
      style={{
        display: 'inline-block',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
      }}
    >
      Path {path}
    </span>
  );
}

function AlreadyTrackedCallout({ trackedDeckId }: { readonly trackedDeckId: number }) {
  return (
    <div
      role="status"
      style={{
        background: '#fffaf0',
        border: '1px solid #f6ad55',
        borderLeft: '4px solid #dd6b20',
        borderRadius: '6px',
        padding: '0.875rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <strong style={{ color: '#9c4221' }}>This deck is already tracked.</strong>
      <Link
        to="/decks/$deckId"
        params={{ deckId: String(trackedDeckId) }}
        style={{ color: '#2b6cb0', fontWeight: 600 }}
      >
        Go to deck &rarr;
      </Link>
    </div>
  );
}

interface ITrackActionsProps {
  readonly onTrack: () => void;
  readonly onTrackAndSeed: () => void;
  readonly isTracking: boolean;
}

function TrackActions({ onTrack, onTrackAndSeed, isTracking }: ITrackActionsProps) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        disabled={isTracking}
        onClick={onTrack}
        style={{
          padding: '0.5rem 1rem',
          background: '#2b6cb0',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: isTracking ? 'wait' : 'pointer',
          opacity: isTracking ? 0.7 : 1,
        }}
      >
        {isTracking ? 'Tracking...' : 'Track this deck'}
      </button>
      <button
        type="button"
        disabled={isTracking}
        onClick={onTrackAndSeed}
        style={{
          padding: '0.5rem 1rem',
          background: 'white',
          color: '#2b6cb0',
          border: '1px solid #2b6cb0',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: isTracking ? 'wait' : 'pointer',
          opacity: isTracking ? 0.7 : 1,
        }}
      >
        Track + add cards to collection
      </button>
    </div>
  );
}

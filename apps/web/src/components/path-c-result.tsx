import { IBreakdown, ISubstitutedEntry } from '../api/deck-detail';
import { IShoppingLineResponse } from '../api/shopping-line';
import { BreakdownList } from './breakdown-list';
import { ShoppingLine } from './ShoppingLine';

interface IPathCResultProps {
  readonly breakdown: IBreakdown;
  readonly fidelityPercent: number;
  /**
   * Fires when the user clicks "Track proximal version". The parent
   * should call the tracked-deck import flow with `seedInventory: false`.
   * No-op by default so the component stays standalone in Unit 8; Unit 6
   * will wire this up when TestDeckResult integrates Path C.
   */
  readonly onTrackProximalVersion?: () => void;
  /**
   * Optional mark-owned handler forwarded to the embedded BreakdownList.
   * Path C callers that do not want the mark-owned affordance can omit
   * it and the component falls back to a read-only breakdown.
   */
  readonly onMarkOwned?: (cardIdentifier: string) => void;
  readonly isMarkingOwned?: boolean;
  readonly pendingCard?: string | null;
  /** Shopping line data from the API response. Added in Phase 1b. */
  readonly shoppingLine?: IShoppingLineResponse;
}

const MISSING_SECTION_ID = 'path-c-missing-cards';

function pitchColor(pitch: number | null | undefined): string {
  switch (pitch) {
    case 1:
      return '#c53030'; // red
    case 2:
      return '#d69e2e'; // yellow
    case 3:
      return '#3182ce'; // blue
    default:
      return '#718096'; // colorless / unknown
  }
}

function pitchLabel(pitch: number | null | undefined): string {
  switch (pitch) {
    case 1:
      return 'Red';
    case 2:
      return 'Yellow';
    case 3:
      return 'Blue';
    default:
      return 'Colorless';
  }
}

function summarizeTiers(substituted: readonly ISubstitutedEntry[]): string {
  let tier1 = 0;
  let tier2 = 0;
  for (const entry of substituted) {
    if (entry.match.tier === 1) tier1 += entry.original.quantity;
    else if (entry.match.tier === 2) tier2 += entry.original.quantity;
  }
  return `${tier1} ${tier1 === 1 ? 'card' : 'cards'} substituted at tier 1, ${tier2} ${tier2 === 1 ? 'card' : 'cards'} at tier 2`;
}

function countMissing(breakdown: IBreakdown): number {
  return breakdown.missing.reduce((sum, e) => sum + e.quantity, 0);
}

/**
 * Path C result display: a closest-playable-version summary anchored by
 * the tier-weighted fidelity percentage.
 *
 * This component is standalone in Unit 8 and is not yet imported by
 * `TestDeckResult` (that integration is Unit 6's responsibility). It
 * renders a complete Path C experience so Unit 6 can drop it in with a
 * single import.
 */
export function PathCResult({
  breakdown,
  fidelityPercent,
  onTrackProximalVersion,
  onMarkOwned,
  isMarkingOwned = false,
  pendingCard = null,
  shoppingLine,
}: IPathCResultProps) {
  const displayFidelity = Math.round(fidelityPercent * 10) / 10;
  const missingCount = countMissing(breakdown);
  const tierSummary = summarizeTiers(breakdown.substituted);

  const handleTrackProximal = (): void => {
    if (onTrackProximalVersion) {
      onTrackProximalVersion();
    }
  };

  const noopMarkOwned = (_cardIdentifier: string): void => {
    // Intentional no-op: the component is usable without a mark-owned handler.
  };

  return (
    <section
      aria-label="Closest playable version"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <header
        style={{
          backgroundColor: '#fffaf0',
          border: '1px solid #f6ad55',
          borderLeft: '4px solid #dd6b20',
          borderRadius: '6px',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#9c4221',
            fontWeight: 600,
            marginBottom: '0.25rem',
          }}
        >
          Closest playable version
        </div>
        <div
          style={{
            fontSize: '3rem',
            fontWeight: 700,
            color: '#7b341e',
            lineHeight: 1,
          }}
        >
          {displayFidelity}%
        </div>
        <div
          style={{
            marginTop: '0.375rem',
            color: '#7b341e',
            fontSize: '0.9375rem',
          }}
        >
          of this deck can be assembled or substituted from your collection.
        </div>
        <div
          style={{
            marginTop: '0.5rem',
            color: '#9c4221',
            fontSize: '0.8125rem',
          }}
        >
          {tierSummary},{' '}
          {missingCount} {missingCount === 1 ? 'card' : 'cards'} still missing.
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={handleTrackProximal}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dd6b20',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Track proximal version
        </button>
        <a
          href={`#${MISSING_SECTION_ID}`}
          style={{
            padding: '0.5rem 1rem',
            color: '#9c4221',
            border: '1px solid #f6ad55',
            borderRadius: '4px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Show me what&rsquo;s missing
        </a>
      </div>

      <ShoppingLine data={shoppingLine ?? null} />

      <BreakdownList
        breakdown={breakdown}
        onMarkOwned={onMarkOwned ?? noopMarkOwned}
        isMarkingOwned={isMarkingOwned}
        pendingCard={pendingCard}
      />

      <section
        id={MISSING_SECTION_ID}
        aria-label="Still missing"
        style={{
          backgroundColor: '#fff5f5',
          border: '1px solid #fc8181',
          borderRadius: '6px',
          padding: '1rem 1.25rem',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem', color: '#c53030' }}>
          Still missing ({missingCount})
        </h3>
        {breakdown.missing.length === 0 ? (
          <p style={{ color: '#718096', fontSize: '0.875rem', margin: 0 }}>
            All cards accounted for!
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {breakdown.missing.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #fed7d7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                }}
              >
                <span
                  aria-label={pitchLabel(undefined)}
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '9999px',
                    backgroundColor: pitchColor(undefined),
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#742a2a', fontWeight: 500 }}>
                  {entry.cardIdentifier}
                </span>
                <span style={{ color: '#a0aec0', fontSize: '0.8125rem' }}>
                  x{entry.quantity} ({entry.slot})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </section>
  );
}

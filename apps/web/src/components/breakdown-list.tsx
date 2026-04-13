import { IBreakdown } from '../api/deck-detail';
import { SubstitutionRow } from './substitution-row';
import { MarkOwnedButton } from './mark-owned-button';

interface IBreakdownListProps {
  readonly breakdown: IBreakdown;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
  /**
   * When supplied, each substitution row renders a reject button.
   * Invoked with the **substitute** card identifier.
   */
  readonly onRejectSubstitute?: (substituteIdentifier: string) => void;
  /**
   * Substitute identifier whose rejection is currently in flight.
   */
  readonly pendingRejection?: string | null;
  /**
   * Set of original card identifiers that should render a curve
   * warning on their substitution row.
   */
  readonly curveWarnings?: ReadonlySet<string>;
}

export function BreakdownList({
  breakdown,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
  onRejectSubstitute,
  pendingRejection = null,
  curveWarnings,
}: IBreakdownListProps) {
  const anyRejectionPending = pendingRejection !== null;

  // Use the engine-computed notOwned list. Fall back to missing for legacy
  // snapshots persisted before the notOwned field existed.
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Exact matches */}
      <section>
        <h3 style={{ margin: '0 0 0.5rem', color: '#38a169' }}>
          Exact ({breakdown.exact.length})
        </h3>
        {breakdown.exact.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.875rem' }}>
            No exact matches
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {breakdown.exact.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                style={{
                  padding: '0.375rem 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{entry.cardIdentifier}</span>
                <span style={{ color: '#999' }}>
                  x{entry.quantity} ({entry.slot})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Substituted */}
      <section>
        <h3 style={{ margin: '0 0 0.5rem', color: '#d69e2e' }}>
          Substituted ({breakdown.substituted.length})
        </h3>
        {breakdown.substituted.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.875rem' }}>
            No substitutions
          </p>
        ) : (
          <div>
            {breakdown.substituted.map((entry) => (
              <SubstitutionRow
                key={`${entry.original.cardIdentifier}-${entry.original.slot}`}
                original={entry.original}
                match={entry.match}
                onReject={onRejectSubstitute}
                isPending={
                  pendingRejection === entry.match.substitute.cardIdentifier
                }
                anyPending={anyRejectionPending}
                curveWarning={curveWarnings?.has(entry.original.cardIdentifier)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Not owned — all cards the user doesn't fully own, regardless
          of whether a substitution suggestion exists. */}
      <section>
        <h3 style={{ margin: '0 0 0.5rem', color: '#e53e3e' }}>
          Not owned ({notOwned.length})
        </h3>
        {notOwned.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.875rem' }}>
            All cards accounted for!
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {notOwned.map((entry) => (
              <li
                key={`${entry.cardIdentifier}-${entry.slot}`}
                style={{
                  padding: '0.375rem 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span>{entry.cardIdentifier}</span>
                  <span style={{ color: '#999', marginLeft: '0.5rem' }}>
                    x{entry.quantity} ({entry.slot})
                  </span>
                </div>
                <MarkOwnedButton
                  cardIdentifier={entry.cardIdentifier}
                  onMarkOwned={onMarkOwned}
                  isPending={isMarkingOwned}
                  pendingCard={pendingCard}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

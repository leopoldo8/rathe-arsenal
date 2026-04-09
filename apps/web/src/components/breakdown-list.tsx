import { IBreakdown, ISubstitutionEntry } from '../api/deck-detail';
import { SubstitutionRow } from './substitution-row';
import { MarkOwnedButton } from './mark-owned-button';

interface IBreakdownListProps {
  readonly breakdown: IBreakdown;
  readonly substitutions: Record<string, ISubstitutionEntry>;
  readonly onMarkOwned: (cardIdentifier: string) => void;
  readonly isMarkingOwned: boolean;
  readonly pendingCard: string | null;
}

export function BreakdownList({
  breakdown,
  substitutions,
  onMarkOwned,
  isMarkingOwned,
  pendingCard,
}: IBreakdownListProps) {
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
            {breakdown.substituted.map((entry) => {
              const sub = substitutions[entry.cardIdentifier];
              if (!sub) {
                return (
                  <div
                    key={`${entry.cardIdentifier}-${entry.slot}`}
                    style={{
                      padding: '0.375rem 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <span>{entry.cardIdentifier}</span>
                    <span style={{ color: '#999', marginLeft: '0.5rem' }}>
                      x{entry.quantity} ({entry.slot})
                    </span>
                  </div>
                );
              }
              return (
                <SubstitutionRow
                  key={`${entry.cardIdentifier}-${entry.slot}`}
                  cardIdentifier={entry.cardIdentifier}
                  substitution={sub}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Missing */}
      <section>
        <h3 style={{ margin: '0 0 0.5rem', color: '#e53e3e' }}>
          Missing ({breakdown.missing.length})
        </h3>
        {breakdown.missing.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.875rem' }}>
            All cards accounted for!
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {breakdown.missing.map((entry) => (
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

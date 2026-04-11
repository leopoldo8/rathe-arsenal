import { IBreakdownEntry, ISubstitutionMatch } from '../api/deck-detail';

interface ISubstitutionRowProps {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
  /**
   * Callback invoked when the user clicks the reject button. Receives
   * the *substitute* identifier (not the original) — that is the
   * identifier the rejection set keys on.
   */
  readonly onReject?: (substituteIdentifier: string) => void;
  /**
   * True when this specific row's rejection is in flight. The row
   * dims to 50% opacity and the reject button disables.
   */
  readonly isPending?: boolean;
  /**
   * True when any row in the list has a rejection in flight. Used
   * to disable reject buttons on every row except the one that
   * triggered the mutation. This prevents conflicting concurrent
   * requests while a rejection is resolving.
   */
  readonly anyPending?: boolean;
  /**
   * When true, renders a pitch-curve warning icon + inline message
   * beneath the substitute. Surfaced when a previous rejection broke
   * the curve and no alternative exists for this slot.
   */
  readonly curveWarning?: boolean;
}

export function SubstitutionRow({
  original,
  match,
  onReject,
  isPending = false,
  anyPending = false,
  curveWarning = false,
}: ISubstitutionRowProps) {
  const disabled = isPending || anyPending;

  function handleReject(): void {
    if (!onReject || disabled) return;
    onReject(match.substitute.cardIdentifier);
  }

  return (
    <div
      data-pending={isPending ? 'true' : 'false'}
      style={{
        padding: '0.5rem 0',
        borderBottom: '1px solid #f0f0f0',
        opacity: isPending ? 0.5 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 500 }}>{original.cardIdentifier}</span>
        <span style={{ color: '#666' }}>&rarr;</span>
        <span style={{ fontWeight: 500, color: '#3182ce' }}>
          {match.substitute.name}
        </span>
        <span
          style={{
            display: 'inline-block',
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            border: '1px solid #d69e2e',
            color: '#d69e2e',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          Tier {match.tier}
        </span>
        <span style={{ color: '#999', fontSize: '0.75rem' }}>
          ({(match.score * 100).toFixed(0)}%)
        </span>
        <span style={{ flex: 1 }} />
        {onReject && (
          <button
            type="button"
            onClick={handleReject}
            disabled={disabled}
            aria-label="Reject this substitution"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: disabled ? '#ccc' : '#e53e3e',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            &times;
          </button>
        )}
      </div>
      <div
        style={{ color: '#888', fontSize: '0.8125rem', marginTop: '0.25rem' }}
      >
        {match.rationale}
      </div>
      {curveWarning && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginTop: '0.375rem',
            color: '#b7791f',
            fontSize: '0.8125rem',
          }}
        >
          <span aria-hidden="true">&#9888;</span>
          Pitch curve broken: no valid alternative for this slot.
        </div>
      )}
    </div>
  );
}

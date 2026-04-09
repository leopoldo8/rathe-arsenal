import { IBreakdownEntry, ISubstitutionMatch } from '../api/deck-detail';

interface ISubstitutionRowProps {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
}

export function SubstitutionRow({ original, match }: ISubstitutionRowProps) {
  return (
    <div
      style={{
        padding: '0.5rem 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 500 }}>
          {original.cardIdentifier}
        </span>
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
      </div>
      <div style={{ color: '#888', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
        {match.rationale}
      </div>
    </div>
  );
}

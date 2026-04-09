import { ISubstitutionEntry } from '../api/deck-detail';

interface ISubstitutionRowProps {
  readonly cardIdentifier: string;
  readonly substitution: ISubstitutionEntry;
}

function getTierColor(tier: string): string {
  switch (tier.toLowerCase()) {
    case 'exact':
      return '#38a169';
    case 'close':
      return '#3182ce';
    case 'functional':
      return '#d69e2e';
    case 'loose':
      return '#e53e3e';
    default:
      return '#999';
  }
}

function getTierBadgeStyle(tier: string): React.CSSProperties {
  const color = getTierColor(tier);
  return {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    border: `1px solid ${color}`,
    color,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  };
}

export function SubstitutionRow({
  cardIdentifier,
  substitution,
}: ISubstitutionRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <span style={{ fontWeight: 500, minWidth: '120px' }}>
        {cardIdentifier}
      </span>
      <span style={{ color: '#666' }}>-&gt;</span>
      <span style={{ fontWeight: 500 }}>{substitution.substitute}</span>
      <span style={getTierBadgeStyle(substitution.tier)}>
        {substitution.tier}
      </span>
      <span style={{ color: '#888', fontSize: '0.8125rem', flex: 1 }}>
        {substitution.rationale}
      </span>
    </div>
  );
}

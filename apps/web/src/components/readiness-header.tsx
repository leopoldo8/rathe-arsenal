interface IReadinessHeaderProps {
  readonly effectivePercent: number;
  readonly rawPercent: number;
  readonly fabraryUlid: string;
  readonly deckName: string;
  readonly hero: string;
  readonly format: string;
}

function getPercentColor(percent: number): string {
  if (percent >= 80) return '#38a169';
  if (percent >= 50) return '#d69e2e';
  return '#e53e3e';
}

export function ReadinessHeader({
  effectivePercent,
  rawPercent,
  fabraryUlid,
  deckName,
  hero,
  format,
}: IReadinessHeaderProps) {
  const fabraryUrl = `https://fabrary.com/decks/${fabraryUlid}`;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          marginBottom: '0.25rem',
        }}
      >
        <h1 style={{ margin: 0 }}>{deckName}</h1>
      </div>
      <div style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>
        {hero} -- {format}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <span
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: getPercentColor(effectivePercent),
          }}
        >
          {effectivePercent.toFixed(1)}%
        </span>
        <span style={{ color: '#999', fontSize: '0.875rem' }}>
          effective ({rawPercent.toFixed(1)}% raw)
        </span>
      </div>
      <a
        href={fabraryUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          marginTop: '0.75rem',
          color: '#3182ce',
          fontSize: '0.875rem',
        }}
      >
        View on Fabrary
      </a>
    </div>
  );
}

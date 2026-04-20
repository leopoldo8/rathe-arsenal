import styles from './ReadinessHero.module.css';

interface IReadinessHeroProps {
  readonly effectivePercent: number;
  readonly rawPercent: number;
  readonly fidelityPercent: number;
  readonly fabraryUlid: string;
  readonly deckName: string;
  readonly hero: string;
  readonly format: string;
}

function getReadinessClass(percent: number): string {
  if (percent >= 80) return styles['readiness--high'] ?? '';
  if (percent >= 50) return styles['readiness--mid'] ?? '';
  return styles['readiness--low'] ?? '';
}

/**
 * ReadinessHero — Column A of deck detail.
 *
 * Renders the deck name, hero/format meta, the signature readiness display
 * (.ra-readiness-display reserved for effectivePercent only — R7), the raw/
 * fidelity breakdown, and a link to Fabrary.
 */
export function ReadinessHero({
  effectivePercent,
  rawPercent,
  fidelityPercent,
  fabraryUlid,
  deckName,
  hero,
  format,
}: IReadinessHeroProps): React.ReactElement {
  const fabraryUrl = `https://fabrary.com/decks/${fabraryUlid}`;
  const readinessClass = getReadinessClass(effectivePercent);

  return (
    <div className={styles.hero}>
      <div className={styles.hero__top}>
        <a
          href={fabraryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.hero__fabraryLink}
        >
          View on Fabrary &#x2197;
        </a>
      </div>

      <div className={styles.hero__bottom}>
        <div className={styles.hero__names}>
          <h1 className={styles.hero__deckName}>{deckName}</h1>
          <div className={styles.hero__meta}>
            <span className={styles.hero__metaTag}>{hero}</span>
            <span className={styles.hero__metaSep}>&#183;</span>
            <span className={styles.hero__metaTag}>{format}</span>
          </div>
        </div>

        <div className={styles.hero__readiness}>
          {/* .ra-readiness-display is reserved for the effectivePercent signature treatment — R7 */}
          <div className={`ra-readiness-display ${styles.readiness} ${readinessClass}`}>
            <span className={styles.readiness__number}>
              {effectivePercent.toFixed(1)}
            </span>
            <span className={styles.readiness__sym}>%</span>
          </div>
          <div className={styles.readiness__label}>Effective Ready</div>
          <div className={styles.readiness__raw}>
            Raw {rawPercent.toFixed(1)}% &#183; Fidelity {(Math.round(fidelityPercent * 10) / 10).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className={styles.hero__bar}>
        <div
          className={styles.hero__barFill}
          style={{ '--pct': `${effectivePercent}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

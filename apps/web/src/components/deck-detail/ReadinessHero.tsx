import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ReadinessHero.module.css';
import { setCssVar } from '../../lib/dom/setCssVar';

interface IReadinessHeroProps {
  readonly effectivePercent: number;
  readonly rawPercent: number;
  readonly fidelityPercent: number;
  readonly fabraryUlid: string | null;
  readonly deckName: string;
  readonly hero: string;
  readonly format: string;
  /**
   * Total quantity of cards in the deck (exact + substituted + missing).
   * Displayed in the "X/Y cartas" count alongside the percentage.
   */
  readonly totalCards: number;
  /**
   * Quantity of cards already covered: sum of quantities for exact matches
   * plus substituted matches. This is the numerator in the "X/Y cartas" count.
   */
  readonly provisionedCards: number;
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
  totalCards,
  provisionedCards,
}: IReadinessHeroProps): React.ReactElement {
  const { t } = useTranslation();
  const fabraryUrl = fabraryUlid ? `https://fabrary.com/decks/${fabraryUlid}` : null;
  const readinessClass = getReadinessClass(effectivePercent);

  // --pct drives the bar fill width via CSS (continuous value, no first-paint
  // race concern since the bar is decorative, not load-bearing geometry).
  const barFillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCssVar(barFillRef.current, '--pct', `${effectivePercent}%`);
  }, [effectivePercent]);

  return (
    <div className={styles.hero}>
      <div className={styles.hero__top}>
        {fabraryUrl && (
          <a
            href={fabraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.hero__fabraryLink}
          >
            {t('decks.viewOnFabraryLink')}
          </a>
        )}
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
          <div className={styles.readiness__label}>
            {t('decks.effectiveReady')}
            <span className={styles.readiness__count}>
              {' '}&middot;{' '}{t('decks.provisionedCount', { provisioned: provisionedCards, total: totalCards })}
            </span>
          </div>
          <div className={styles.readiness__raw}>
            {t('decks.rawFidelity', {
              raw: rawPercent.toFixed(1),
              fidelity: (Math.round(fidelityPercent * 10) / 10).toFixed(1),
            })}
          </div>
        </div>
      </div>

      <div className={styles.hero__bar}>
        <div
          ref={barFillRef}
          className={styles.hero__barFill}
        />
      </div>
    </div>
  );
}

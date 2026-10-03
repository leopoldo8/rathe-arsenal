import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { setCssVar } from '../../lib/dom/setCssVar';
import { useImageFallback } from '../../hooks/useImageFallback';
import { resolveMedallionBand } from './resolveMedallionBand';
import styles from './ReadinessMedallion.module.css';

export type TMedallionSize = 'sm' | 'lg';

export interface IHeroArt {
  readonly small: string;
  readonly smallSources: readonly string[];
}

export interface IReadinessMedallionProps {
  readonly pct: number;
  readonly size: TMedallionSize;
  readonly heroName: string;
  readonly heroArt: IHeroArt | null;
  readonly className?: string | undefined;
}

export function ReadinessMedallion({
  pct,
  size,
  heroName,
  heroArt,
  className,
}: IReadinessMedallionProps): React.ReactElement {
  const { t } = useTranslation();
  const ringRef = useRef<HTMLDivElement>(null);
  const art = useImageFallback(heroArt?.smallSources ?? []);
  const sweepPct = Math.max(0, Math.min(100, pct));
  const display = Math.round(pct);

  useEffect(() => {
    setCssVar(ringRef.current, '--ra-medallion-pct', `${sweepPct}%`);
  }, [sweepPct]);

  const rootClass = [styles.medallion, className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      role="meter"
      aria-label={t('common.readinessMedallionLabel')}
      aria-valuenow={display}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={t('common.readinessValueText', { pct: display })}
      data-band={resolveMedallionBand(pct)}
      data-size={size}
      data-testid="readiness-medallion"
    >
      {art.src ? (
        <img
          className={styles.art}
          src={art.src}
          alt=""
          aria-hidden="true"
          onError={art.onError}
          data-testid="readiness-medallion-art"
        />
      ) : (
        <div
          className={`${styles.art} ${styles.artFallback}`}
          aria-hidden="true"
          data-testid="readiness-medallion-art-fallback"
        />
      )}
      <div className={styles.shade} aria-hidden="true" />
      <div ref={ringRef} className={styles.ring} aria-hidden="true" />
      <div className={styles.label}>
        <span className={styles.number}>
          {display}
          {size === 'lg' && <span className={styles.percent}>%</span>}
        </span>
        {size === 'lg' && <span className={styles.heroName}>{heroName}</span>}
      </div>
    </div>
  );
}

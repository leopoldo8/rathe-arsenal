import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TGenerationStatus } from '../../../api/recommendations';
import styles from './GenerationStatus.module.css';

const RING_RADIUS = 12;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const FULL_TURN_WITHOUT_TYPICAL_MS = 240_000;
const MINUTE_MS = 60_000;

interface IGenerationStatusProps {
  readonly status: TGenerationStatus;
  readonly elapsedMs: number;
  /** When `elapsedMs` was measured, on this client's clock. */
  readonly measuredAt: number;
  readonly typicalMs: number | null;
  readonly poolSize: number | null;
  readonly heroName: string;
}

function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function GenerationStatus({ status, elapsedMs, measuredAt, typicalMs, poolSize, heroName }: IGenerationStatusProps): React.ReactElement {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = elapsedMs + Math.max(0, now - measuredAt);
  const fullTurnMs = typicalMs === null ? FULL_TURN_WITHOUT_TYPICAL_MS : typicalMs * 2;
  const overdue = typicalMs !== null && elapsed > typicalMs;
  const step =
    status === 'running'
      ? t('recommendations.step.running', { count: poolSize ?? 0, hero: heroName })
      : t(`recommendations.step.${status}`);

  return (
    <div className={styles.status} role="status" data-testid="recommendations-generating">
      <div className={styles.clockLine}>
        <svg className={styles.ring} viewBox="0 0 30 30" aria-hidden="true">
          <circle className={styles.track} cx="15" cy="15" r={RING_RADIUS} />
          <circle
            className={styles.arc}
            cx="15"
            cy="15"
            r={RING_RADIUS}
            strokeDasharray={`${Math.min(1, elapsed / fullTurnMs) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            transform="rotate(-90 15 15)"
          />
          {typicalMs !== null && <line className={styles.mark} x1="15" y1="26" x2="15" y2="30" data-testid="generation-typical-mark" />}
        </svg>
        <span className={styles.clock} aria-label={t('recommendations.clockAria')} data-testid="generation-clock">
          {formatClock(elapsed)}
        </span>
        {typicalMs !== null && (
          <span className={styles.usual} data-testid="generation-usual">
            · {t('recommendations.usual', { minutes: Math.ceil(typicalMs / MINUTE_MS) })}
          </span>
        )}
      </div>
      <p className={overdue ? styles.overdue : styles.step} data-testid="generation-step">
        {overdue ? t('recommendations.overdue') : step}
      </p>
    </div>
  );
}

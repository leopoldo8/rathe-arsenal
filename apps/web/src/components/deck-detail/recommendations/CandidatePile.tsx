import React, { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IPoolSampleCard } from '../../../api/recommendations';
import { CARD_BACK_SRC } from './card-naming';
import styles from './CandidatePile.module.css';

export const PILE_LIFT_INTERVAL_MS = 1200;

interface ICandidatePileProps {
  readonly poolSize: number | null;
  readonly sample: readonly IPoolSampleCard[];
  readonly lifting: boolean;
  readonly folding: boolean;
}

/** The ref points at the stack itself: it is the box the dealt cards fly from. */
export const CandidatePile = forwardRef<HTMLDivElement, ICandidatePileProps>(function CandidatePile(
  { poolSize, sample, lifting, folding },
  stackRef,
) {
  const { t } = useTranslation();
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (!lifting || sample.length === 0) return undefined;
    const timer = window.setInterval(() => setLift((current) => current + 1), PILE_LIFT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [lifting, sample.length]);

  const lifted = lifting && sample.length > 0 ? sample[lift % sample.length]! : null;

  return (
    <li className={`${styles.column} ${folding ? styles.folding : ''}`} data-testid="recommendations-pile" aria-hidden={folding}>
      <div className={styles.stack} ref={stackRef}>
        <img className={styles.back} src={CARD_BACK_SRC} alt="" draggable={false} />
        <img className={styles.back} src={CARD_BACK_SRC} alt="" draggable={false} />
        <img className={styles.back} src={CARD_BACK_SRC} alt="" draggable={false} />
        {lifted !== null && (
          <div className={styles.lift} key={lift} data-testid="recommendations-pile-lift">
            <div className={styles.flip}>
              <img className={styles.face} src={CARD_BACK_SRC} alt="" draggable={false} />
              <img className={`${styles.face} ${styles.front}`} src={lifted.imageUrl.small} alt={lifted.name} draggable={false} />
            </div>
          </div>
        )}
      </div>
      {poolSize !== null && (
        <p className={styles.count}>
          <span className={styles.number}>{poolSize}</span>
          {t('recommendations.candidates')}
        </p>
      )}
      <p className={styles.peek} data-testid="recommendations-pile-name">
        {lifted?.name ?? ''}
      </p>
    </li>
  );
});

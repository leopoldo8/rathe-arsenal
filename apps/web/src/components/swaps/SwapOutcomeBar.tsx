import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TSwapOutcome } from '../../api/swaps';
import styles from './SwapOutcomeBar.module.css';

interface ISwapOutcomeBarProps {
  readonly outcome: TSwapOutcome | null;
  readonly isBusy: boolean;
  readonly onChange: (outcome: TSwapOutcome) => void;
}

export function SwapOutcomeBar({
  outcome,
  isBusy,
  onChange,
}: ISwapOutcomeBarProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.bar} data-testid="swap-outcome-bar">
      <span className={styles.prompt}>{t('swaps.outcomePrompt')}</span>
      <button
        type="button"
        className={`${styles.pill} ${outcome === 'worked' ? styles.pillWorked : ''}`}
        aria-pressed={outcome === 'worked'}
        disabled={isBusy}
        onClick={() => onChange('worked')}
      >
        {t('swaps.outcomeWorked')}
      </button>
      <button
        type="button"
        className={`${styles.pill} ${outcome === 'did_not_work' ? styles.pillDidNotWork : ''}`}
        aria-pressed={outcome === 'did_not_work'}
        disabled={isBusy}
        onClick={() => onChange('did_not_work')}
      >
        {t('swaps.outcomeDidNotWork')}
      </button>
    </div>
  );
}

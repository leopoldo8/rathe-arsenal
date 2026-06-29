import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button/Button';
import styles from './CongratsAllPlayable.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ICongratsAllPlayableProps {
  readonly onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CongratsAllPlayable — shown as the step 3 replacement when all imported
 * decks have raw readiness = 100% and no substitutions are needed.
 *
 * The step indicator shows step III as complete. Single CTA routes to /home.
 */
export function CongratsAllPlayable({ onComplete }: ICongratsAllPlayableProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.eyebrow}>{t('onboarding.congratsEyebrow')}</div>
      <div className={styles.badge} aria-hidden="true">100%</div>
      <h1 className={styles.heading}>{t('onboarding.congratsHeading')}</h1>
      <p className={styles.body}>{t('onboarding.congratsBody')}</p>
      <Button type="button" variant="primary" size="lg" onClick={onComplete}>
        {t('onboarding.goToMyDecks')}
      </Button>
    </div>
  );
}

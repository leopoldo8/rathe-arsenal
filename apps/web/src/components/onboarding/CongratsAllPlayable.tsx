import React from 'react';
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
  return (
    <div className={styles.container}>
      <div className={styles.eyebrow}>Step 3 of 3</div>
      <div className={styles.badge} aria-hidden="true">100%</div>
      <h1 className={styles.heading}>You are fully playable!</h1>
      <p className={styles.body}>
        Incredible — your collection already covers everything in your deck. No substitutions
        needed. Head to your armory to see the full breakdown.
      </p>
      <Button type="button" variant="primary" size="lg" onClick={onComplete}>
        Go to my decks
      </Button>
    </div>
  );
}

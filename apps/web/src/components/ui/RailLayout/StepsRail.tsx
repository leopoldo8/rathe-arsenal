import React from 'react';
import styles from './Rails.module.css';

export interface IRailStep {
  readonly label: string;
}

interface IStepsRailProps {
  readonly steps: readonly IRailStep[];
  /** Index of the step the player is on. */
  readonly current: number;
}

/** The steps of a flow, the current one marked; for orientation, not navigation. */
export function StepsRail({ steps, current }: IStepsRailProps): React.ReactElement {
  return (
    <div className={styles.steps}>
      {steps.map((step, index) => (
        <div key={step.label} className={styles.step} aria-current={index === current ? 'step' : undefined} data-done={index < current}>
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          {step.label}
        </div>
      ))}
    </div>
  );
}

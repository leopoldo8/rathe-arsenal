import React from 'react';
import styles from './StepIndicator.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TStepState = 'complete' | 'current' | 'upcoming';

export interface IStepIndicatorProps {
  /** Total number of steps (must match steps array length). */
  readonly totalSteps: 3;
  /** Active step number (1-indexed). */
  readonly currentStep: 1 | 2 | 3;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Roman numeral labels per step. Locked per Polish Notes. */
const ROMAN_NUMERALS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
};

const STEP_LABELS: Record<number, string> = {
  1: 'Paste deck',
  2: 'Confirm library',
  3: 'Review subs',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveState(stepNumber: number, currentStep: number): TStepState {
  if (stepNumber < currentStep) return 'complete';
  if (stepNumber === currentStep) return 'current';
  return 'upcoming';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StepIndicator — horizontal progress indicator for the onboarding wizard.
 *
 * Renders roman numerals (I / II / III) with diamond separators.
 * Active/completed/upcoming states drive visual styling via CSS Modules.
 *
 * A11y: the root nav element carries an aria-label and each step has a
 * descriptive aria-label that announces "Step N of 3: Label (state)".
 */
export function StepIndicator({ currentStep }: IStepIndicatorProps): React.ReactElement {
  const steps = [1, 2, 3] as const;

  return (
    <nav
      aria-label={`Step ${currentStep} of 3`}
      className={styles.stepIndicator}
    >
      <ol className={styles.stepList} role="list">
        {steps.map((stepNumber, index) => {
          const state = resolveState(stepNumber, currentStep);
          const label = STEP_LABELS[stepNumber] ?? '';
          const roman = ROMAN_NUMERALS[stepNumber] ?? '';
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={stepNumber}>
              <li
                className={[
                  styles.step,
                  styles[`step--${state}`],
                ].join(' ')}
                aria-label={`Step ${stepNumber} of 3: ${label}, ${state}`}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className={styles.stepNumeral} aria-hidden="true">
                  {roman}
                </span>
                <span className={styles.stepLabel}>{label}</span>
              </li>
              {!isLast && (
                <li
                  className={[
                    styles.separator,
                    stepNumber < currentStep ? styles['separator--passed'] : '',
                  ].filter(Boolean).join(' ')}
                  aria-hidden="true"
                  role="presentation"
                >
                  <span className={styles.diamond} />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

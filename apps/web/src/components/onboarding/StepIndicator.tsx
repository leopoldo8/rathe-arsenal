import React from 'react';
import { useTranslation } from 'react-i18next';
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

// STEP_LABELS are resolved inside the component via t() so they are locale-aware.

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
  const { t } = useTranslation();
  const steps = [1, 2, 3] as const;

  const stepLabels: Record<number, string> = {
    1: t('onboarding.stepLabel1'),
    2: t('onboarding.stepLabel2'),
    3: t('onboarding.stepLabel3'),
  };

  const stepStates: Record<string, string> = {
    complete: t('onboarding.stepStateComplete'),
    current: t('onboarding.stepStateCurrent'),
    upcoming: t('onboarding.stepStateUpcoming'),
  };

  return (
    <nav
      aria-label={t('onboarding.stepNavAriaLabel', { current: currentStep, total: 3 })}
      className={styles.stepIndicator}
    >
      <ol className={styles.stepList} role="list">
        {steps.map((stepNumber, index) => {
          const state = resolveState(stepNumber, currentStep);
          const label = stepLabels[stepNumber] ?? '';
          const stateLabel = stepStates[state] ?? state;
          const roman = ROMAN_NUMERALS[stepNumber] ?? '';
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={stepNumber}>
              <li
                className={[
                  styles.step,
                  styles[`step--${state}`],
                ].join(' ')}
                aria-label={t('onboarding.stepItemAriaLabel', { number: stepNumber, total: 3, label, state: stateLabel })}
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

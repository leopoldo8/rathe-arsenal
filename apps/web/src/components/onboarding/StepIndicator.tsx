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
  /** Called for completed nodes only; omit for a read-only indicator. */
  readonly onStepClick?: ((step: 1 | 2 | 3) => void) | undefined;
}

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
 * Three circular nodes joined by hairline connectors. Only completed nodes
 * are interactive: later steps need data the wizard has not collected yet.
 *
 * A11y: the root nav element carries an aria-label and each step has a
 * descriptive aria-label that announces "Step N of 3: Label (state)".
 */
export function StepIndicator({ currentStep, onStepClick }: IStepIndicatorProps): React.ReactElement {
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
          const isLast = index === steps.length - 1;
          const itemLabel = t('onboarding.stepItemAriaLabel', { number: stepNumber, total: 3, label, state: stateLabel });
          const nodeClass = [styles.node, styles[`node--${state}`]].join(' ');

          return (
            <React.Fragment key={stepNumber}>
              <li
                className={[styles.step, styles[`step--${state}`]].join(' ')}
                aria-label={itemLabel}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {state === 'complete' && onStepClick != null ? (
                  <button
                    type="button"
                    className={`${nodeClass} ${styles.nodeButton}`}
                    aria-label={itemLabel}
                    onClick={() => onStepClick(stepNumber)}
                  />
                ) : (
                  <span
                    className={nodeClass}
                    aria-hidden="true"
                    aria-disabled={state === 'upcoming' ? 'true' : undefined}
                  />
                )}
                <span className={styles.stepLabel}>{label}</span>
              </li>
              {!isLast && (
                <li className={styles.connectorItem} aria-hidden="true" role="presentation">
                  <span
                    className={[
                      styles.connector,
                      stepNumber < currentStep ? styles['connector--passed'] : '',
                    ].filter(Boolean).join(' ')}
                  />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

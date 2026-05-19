import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { StepIndicator } from './StepIndicator';
import { Step1PasteUrl, IStep1Result } from './Step1PasteUrl';
import { Step2ConfirmLibrary } from './Step2ConfirmLibrary';
import { Step3FirstReview } from './Step3FirstReview';
import styles from './OnboardingWizard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TWizardStep = 1 | 2 | 3;

interface IWizardState {
  readonly step: TWizardStep;
  readonly importedDecks: IStep1Result['importedDecks'];
  readonly urls: readonly string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * OnboardingWizard — 3-step new-user onboarding flow.
 *
 * Step 1: Paste a Fabrary deck URL.
 * Step 2: Confirm the imported deck library.
 * Step 3: Review first substitutions (or see CongratsAllPlayable if 100% ready).
 *
 * Skip on any step routes to /home.
 * Completing step 3 routes to /home.
 */
export function OnboardingWizard(): React.ReactElement {
  const navigate = useNavigate();

  const [state, setState] = useState<IWizardState>({
    step: 1,
    importedDecks: [],
    urls: [],
  });

  function handleSkip(): void {
    void navigate({ to: '/home', search: { tag: [] } });
  }

  function handleStep1Complete(result: IStep1Result): void {
    setState((prev) => ({
      ...prev,
      step: 2,
      importedDecks: result.importedDecks,
      urls: result.urls,
    }));
  }

  function handleStep2Complete(): void {
    setState((prev) => ({ ...prev, step: 3 }));
  }

  function handleStep2Back(): void {
    setState((prev) => ({ ...prev, step: 1 }));
  }

  function handleStep3Complete(): void {
    void navigate({ to: '/home', search: { tag: [] } });
  }

  function handleStep3Back(): void {
    setState((prev) => ({ ...prev, step: 2 }));
  }

  const importedDeckIds = state.importedDecks.map((d) => d.trackedDeckId);

  return (
    <section className={styles.wizard} aria-label="Onboarding wizard">
      <StepIndicator totalSteps={3} currentStep={state.step} />

      <div className={styles.body}>
        {state.step === 1 && (
          <Step1PasteUrl onComplete={handleStep1Complete} onSkip={handleSkip} />
        )}
        {state.step === 2 && (
          <Step2ConfirmLibrary
            importedDecks={state.importedDecks}
            onComplete={handleStep2Complete}
            onBack={handleStep2Back}
            onSkip={handleSkip}
          />
        )}
        {state.step === 3 && (
          <Step3FirstReview
            importedDeckIds={importedDeckIds}
            onComplete={handleStep3Complete}
            onBack={handleStep3Back}
            onSkip={handleSkip}
          />
        )}
      </div>
    </section>
  );
}

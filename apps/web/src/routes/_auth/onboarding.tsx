import React from 'react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useDecksQuery } from '../../api/decks';
import { OnboardingWizard } from '../../components/onboarding/OnboardingWizard';

export const Route = createFileRoute('/_auth/onboarding')({
  component: OnboardingPage,
});

/**
 * Onboarding page — entry point for the 3-step onboarding wizard.
 *
 * R60 guard: if the user already has tracked decks, redirect to /import
 * (the plain import page). While the decks query is loading, render null
 * to prevent a flash of the wizard for returning users on slow networks.
 *
 * The guard intentionally catches mid-wizard re-entry: a user who completed
 * step 1 (decks imported), navigated away, and then returned to /onboarding
 * is redirected to /import rather than resuming the wizard. This is a
 * deliberate block — v1 has no in-progress-onboarding state persistence.
 */
export function OnboardingPage(): React.ReactElement | null {
  const decksQuery = useDecksQuery();

  // While resolving, render nothing to avoid flashing the wizard.
  if (decksQuery.isLoading) return null;

  // R60: returning user with existing decks → redirect to import.
  const trackedDecks = decksQuery.data?.trackedDecks ?? [];
  if (trackedDecks.length > 0) {
    return <Navigate to="/import" replace />;
  }

  return <OnboardingWizard />;
}

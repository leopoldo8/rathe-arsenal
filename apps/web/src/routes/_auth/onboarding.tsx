import React from 'react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useDecksQuery } from '../../api/decks';
import { useCsvSourcesQuery } from '../../api/csv-sources';
import { FirstRunChooser } from '../../components/onboarding/FirstRunChooser';
import { DEFAULT_LIBRARY_SEARCH } from './-library.helpers';
import { OnboardingSkeleton } from '../../components/onboarding/OnboardingSkeleton';

export const Route = createFileRoute('/_auth/onboarding')({
  component: OnboardingPage,
});

/**
 * First-run page: the screen "Como você quer começar?" for an account with no deck, no card and no import.
 *
 * R60 guard: an account that already has tracked decks goes to /decks/new (the deck tracking
 * surface), and one that has cards but no deck goes to the collection. While the decks query is
 * loading, a skeleton avoids a flash of the first-run screen for a returning player on a slow network.
 */
export function OnboardingPage(): React.ReactElement {
  const decksQuery = useDecksQuery();
  const sourcesQuery = useCsvSourcesQuery();

  // While resolving, show a skeleton to avoid a blank flash (R59).
  if (decksQuery.isLoading) return <OnboardingSkeleton />;

  // R60: returning user with existing decks → redirect to /decks/new.
  const trackedDecks = decksQuery.data?.trackedDecks ?? [];
  if (trackedDecks.length > 0) {
    return <Navigate to="/decks/new" replace />;
  }

  if ((decksQuery.data?.collectionCardCount ?? 0) > 0) {
    return <Navigate to="/library" search={DEFAULT_LIBRARY_SEARCH} replace />;
  }

  // Any import counts as data, including one whose lines are all unresolved: such a player must see
  // the lines just uploaded, not the first-run screen.
  if (sourcesQuery.isLoading) return <OnboardingSkeleton />;
  if ((sourcesQuery.data ?? []).length > 0) {
    return <Navigate to="/library" search={DEFAULT_LIBRARY_SEARCH} replace />;
  }

  return <FirstRunChooser />;
}

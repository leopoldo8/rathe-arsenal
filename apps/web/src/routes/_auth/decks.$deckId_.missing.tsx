import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { MissingListPage } from '../../components/missing-list/MissingListPage';

export const Route = createFileRoute('/_auth/decks/$deckId_/missing')({
  component: DeckMissingRoute,
});

function DeckMissingRoute(): React.ReactElement {
  const { deckId } = Route.useParams();
  return <MissingListPage deckId={Number(deckId)} />;
}

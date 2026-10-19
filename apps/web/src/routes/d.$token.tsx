import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SharedDeckPage } from '../components/shared-deck/SharedDeckPage';

// Public route: lives outside `_auth` so anyone with the address can open it.
// The link's own intent decides which page renders; a leftover `?view=` is ignored.
export const Route = createFileRoute('/d/$token')({
  component: SharedDeckRoute,
});

function SharedDeckRoute(): React.ReactElement {
  const { token } = Route.useParams();
  return <SharedDeckPage token={token} />;
}

import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SharedListPage } from '../components/shared-list/SharedListPage';

// Public route: lives outside `_auth` so anyone with the address can open it.
export const Route = createFileRoute('/l/$token')({
  component: SharedListRoute,
});

function SharedListRoute(): React.ReactElement {
  const { token } = Route.useParams();
  return <SharedListPage token={token} />;
}

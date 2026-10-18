import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SharedDeckPage } from '../components/shared-deck/SharedDeckPage';
import { validateSharedDeckSearch } from './-shared-deck-search';

// Public route: lives outside `_auth` so anyone with the address can open it.
export const Route = createFileRoute('/d/$token')({
  component: SharedDeckRoute,
  validateSearch: validateSharedDeckSearch,
});

function SharedDeckRoute(): React.ReactElement {
  const { token } = Route.useParams();
  const { view } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <SharedDeckPage
      token={token}
      view={view}
      onViewChange={(next) =>
        void navigate({
          to: '/d/$token',
          params: { token },
          search: next === undefined ? {} : { view: next },
          replace: true,
        })
      }
    />
  );
}

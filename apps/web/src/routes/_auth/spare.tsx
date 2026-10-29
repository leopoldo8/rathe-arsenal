import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { DEFAULT_LIBRARY_SEARCH } from './-library.helpers';
import { SparePage } from '../../components/spare/SparePage';

export const Route = createFileRoute('/_auth/spare')({
  component: SpareRoute,
});

function SpareRoute(): React.ReactElement {
  const navigate = useNavigate();
  return (
    <SparePage
      onBack={() => void navigate({ to: '/library', search: DEFAULT_LIBRARY_SEARCH })}
      onSent={(listId) => void navigate({ to: '/lists/$listId', params: { listId: String(listId) } })}
    />
  );
}

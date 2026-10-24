import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StartGate } from '../components/auth/StartFlow';

// The e-mailed "Entrar" button lands here with `?token=`; the flow signs in with it on arrival.
export const Route = createFileRoute('/entrar')({
  component: EntrarPage,
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === 'string' && search.token !== '' ? { token: search.token } : {},
});

export function EntrarPage(): React.ReactElement | null {
  const { token } = Route.useSearch();
  return <StartGate buttonToken={token} />;
}

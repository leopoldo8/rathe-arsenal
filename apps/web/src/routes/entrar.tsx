import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StartGate } from '../components/auth/StartFlow';
import { sanitizeNextPath } from '../lib/next-path';

// The e-mailed "Entrar" button lands here with `?token=`; the flow signs in with it on arrival.
// A protected page opened signed out lands here with `?next=<that page>`; signing in goes back to it.
export const Route = createFileRoute('/entrar')({
  component: EntrarPage,
  validateSearch: (search: Record<string, unknown>): { token?: string; next?: string } => {
    const next = sanitizeNextPath(search.next);
    return {
      ...(typeof search.token === 'string' && search.token !== '' ? { token: search.token } : {}),
      ...(next !== null ? { next } : {}),
    };
  },
});

export function EntrarPage(): React.ReactElement | null {
  const { token, next } = Route.useSearch();
  return <StartGate buttonToken={token} next={next} />;
}

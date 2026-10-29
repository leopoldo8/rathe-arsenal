import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StartGate } from '../components/auth/StartFlow';
import { isPlausibleEmail } from '../lib/is-plausible-email';
import { sanitizeNextPath } from '../lib/next-path';

// The e-mailed "Entrar" button lands here with `?token=`; the flow signs in with it on arrival.
// A protected page opened signed out lands here with `?next=<that page>`; signing in goes back to it.
// `?email=<address>` opens the code sign-in for that address (the page of a confirmed e-mail offers it).
export const Route = createFileRoute('/entrar')({
  component: EntrarPage,
  validateSearch: (search: Record<string, unknown>): { token?: string; next?: string; email?: string } => {
    const next = sanitizeNextPath(search.next);
    return {
      ...(typeof search.token === 'string' && search.token !== '' ? { token: search.token } : {}),
      ...(next !== null ? { next } : {}),
      ...(typeof search.email === 'string' && isPlausibleEmail(search.email) ? { email: search.email } : {}),
    };
  },
});

export function EntrarPage(): React.ReactElement | null {
  const { token, next, email } = Route.useSearch();
  return <StartGate buttonToken={token} next={next} codeEmail={email} />;
}

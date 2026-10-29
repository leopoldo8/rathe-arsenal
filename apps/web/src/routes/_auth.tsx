import { useRef } from 'react';
import { Outlet, createFileRoute, Navigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../auth/useAuth';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, isLoading } = useAuth();
  const here = useRouterState({ select: (s) => `${s.location.pathname}${s.location.searchStr}` });
  // Once someone was signed in on this page, leaving is their own "Sair": the next sign-in starts at the home.
  const wasSignedIn = useRef(false);
  if (user) wasSignedIn.current = true;
  if (isLoading) return null;
  if (!user) {
    // The router already shows the start page's address while this layout is still mounted for one more
    // render; the redirect has been sent by then, and sending it again would nest `next` inside itself.
    if (here.startsWith('/entrar')) return null;
    // The page that was asked for travels in the address, so signing in lands back on it (AC 240).
    return <Navigate to="/entrar" search={wasSignedIn.current ? {} : { next: here }} replace />;
  }
  return <Outlet />;
}

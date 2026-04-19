import React from 'react';
import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { AppShell } from '../components/shell/AppShell';

export const Route = createRootRoute({
  component: RootLayout,
});

// Routes that render the authenticated shell (AppShell wraps Outlet)
const AUTH_SHELL_PREFIXES = ['/home', '/library', '/import', '/reviews', '/settings', '/decks', '/onboarding'];

// Auth routes render their own full-page layout (AuthLayout per-route)
const AUTH_PAGE_PREFIXES = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email', '/check-your-email'];

function RootLayout(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isAuthShell = AUTH_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  const isAuthPage = AUTH_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  // Authenticated _auth routes: wrap in AppShell
  if (isAuthShell) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }

  // Auth pages (sign-in, sign-up, etc.): each route renders its own AuthLayout
  if (isAuthPage) {
    return <Outlet />;
  }

  // Landing / unknown routes: plain outlet (no shell, no auth layout)
  return <Outlet />;
}

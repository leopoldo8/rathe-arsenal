import React from 'react';
import { createRootRoute, useRouterState } from '@tanstack/react-router';
import { AppShell } from '../components/shell/AppShell';
import { NotFoundState } from '../components/shell/NotFoundState';
import { RootContent } from '../components/shell/RootContent';
import { isSignedInAppPath } from '../components/shell/shell-routes';
import { SignInSheet } from '../components/auth/SignInSheet';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout(): React.ReactElement {
  return (
    <>
      <RootContent />
      <SignInSheet />
    </>
  );
}

/**
 * NotFoundPage — rendered by TanStack Router for any unmatched URL.
 *
 * Renders <NotFoundState> inside the AppShell when the URL starts with an
 * authenticated-shell prefix, otherwise renders it bare (the anon shell
 * is each auth route's own AuthLayout, so unknown anon URLs get no shell
 * wrapper — NotFoundState is self-contained and readable without one).
 */
function NotFoundPage(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isAuthShell = isSignedInAppPath(pathname);

  if (isAuthShell) {
    return (
      <AppShell>
        <NotFoundState />
      </AppShell>
    );
  }

  return <NotFoundState />;
}

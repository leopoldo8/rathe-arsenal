import React from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useIsPhone } from '../auth/useIsPhone';
import { AppShell } from './AppShell';
import { fitsViewport } from './viewport-fit';
import { drawsShell, isAuthShellPath } from './shell-routes';

/**
 * Wraps the signed-in pages in the app shell; every other page renders as it is.
 *
 * A focused page (/spare, /library-pending) is full screen on a phone and has the shell from 720 px.
 * It stays inside the same shell element in both cases, with only the chrome switched off, so
 * crossing that width does not remount the page and the quantities typed on it survive.
 */
export function RootContent(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPhone = useIsPhone();

  if (isAuthShellPath(pathname)) {
    return (
      <AppShell chrome={drawsShell(pathname, isPhone)} fitViewport={fitsViewport(pathname)}>
        <Outlet />
      </AppShell>
    );
  }

  // Auth pages (sign-in, sign-up, etc.) render their own AuthLayout; landing and unknown routes
  // have no shell either, so all of them are a plain outlet.
  return <Outlet />;
}

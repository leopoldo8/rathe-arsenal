import React, { useEffect, useState } from 'react';
import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { AppShell } from '../components/shell/AppShell';
import { NotFoundState } from '../components/shell/NotFoundState';
import { fitsViewport } from '../components/shell/viewport-fit';
import { DESKTOP_MIN_WIDTH_PX, drawsShell, isSignedInAppPath } from '../components/shell/shell-routes';
import { SignInSheet } from '../components/auth/SignInSheet';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

// Auth routes render their own full-page layout (AuthLayout per-route)
const AUTH_PAGE_PREFIXES = ['/entrar', '/sign-in', '/sign-up', '/verify-email', '/check-your-email'];

function RootLayout(): React.ReactElement {
  return (
    <>
      <RootContent />
      <SignInSheet />
    </>
  );
}

const PHONE_QUERY = `(max-width: ${DESKTOP_MIN_WIDTH_PX - 1}px)`;

function useIsPhoneWidth(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = (event: MediaQueryListEvent): void => setIsPhone(event.matches);
    query.addEventListener('change', onChange);
    setIsPhone(query.matches);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return isPhone;
}

function RootContent(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPhone = useIsPhoneWidth();

  const isAuthShell = drawsShell(pathname, isPhone);

  const isAuthPage = AUTH_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );

  // Authenticated _auth routes: wrap in AppShell
  if (isAuthShell) {
    return (
      <AppShell fitViewport={fitsViewport(pathname)}>
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

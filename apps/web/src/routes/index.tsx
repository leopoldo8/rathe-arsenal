import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useAuth } from '../auth/useAuth';

export const Route = createFileRoute('/')({
  component: IndexRedirect,
});

/**
 * `/` has no landing page surface (Plan A Scope Boundaries).
 * Authenticated users go to `/home`; anonymous users to `/sign-in`.
 * During auth resolution the route renders nothing — same pattern
 * as `_auth.tsx` — so there's no flash of stale UI before the
 * redirect fires.
 */
function IndexRedirect(): React.ReactElement | null {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to="/home" search={{ tag: [] }} replace /> : <Navigate to="/sign-in" replace />;
}

import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { StartGate } from '../components/auth/StartFlow';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

/**
 * `/` is the one-field start for a signed-out visitor, as `/entrar` is; a signed-in visitor goes to
 * `/home`. During auth resolution the route renders nothing — same pattern as `_auth.tsx` — so
 * there is no flash of stale UI before the redirect fires.
 */
function IndexPage(): React.ReactElement | null {
  return <StartGate />;
}

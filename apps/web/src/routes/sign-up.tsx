import { createFileRoute, redirect } from '@tanstack/react-router';

// See `sign-in.tsx`: one field at `/entrar` replaces both pages.
export const Route = createFileRoute('/sign-up')({
  beforeLoad: () => {
    throw redirect({ to: '/entrar', replace: true });
  },
});

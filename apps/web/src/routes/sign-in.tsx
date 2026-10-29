import { createFileRoute, redirect } from '@tanstack/react-router';

// The sign-in and sign-up pages became one field at `/entrar`; the links already handed out and the
// shared pages' buttons keep working through this redirect.
export const Route = createFileRoute('/sign-in')({
  beforeLoad: () => {
    throw redirect({ to: '/entrar', replace: true });
  },
});

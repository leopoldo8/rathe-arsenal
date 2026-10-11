import { createFileRoute, redirect } from '@tanstack/react-router';

/** Reviews became swaps, which merged into card alternatives (AD-012); an old link lands on the home page. */
export const Route = createFileRoute('/_auth/reviews')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true });
  },
  component: () => null,
});

import { createFileRoute, redirect } from '@tanstack/react-router';

/** Swaps merged into card alternatives (AD-012); an old link lands on the home page. */
export const Route = createFileRoute('/_auth/swaps')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true });
  },
  component: () => null,
});

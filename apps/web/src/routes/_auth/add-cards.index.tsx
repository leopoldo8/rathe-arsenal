import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/add-cards/')({
  beforeLoad: () => {
    throw redirect({ to: '/add-cards/manual', replace: true });
  },
});

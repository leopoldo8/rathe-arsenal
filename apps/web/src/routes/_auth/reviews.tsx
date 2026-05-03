/**
 * Legacy route — /reviews redirects to /swaps.
 *
 * The Reviews feature was renamed to Swaps. This file keeps the route registered
 * so that any bookmarked or external link to /reviews lands on /swaps instead of
 * a 404. The API route stays at /api/reviews (no breaking deploy in this PR).
 */
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/reviews')({
  beforeLoad: () => {
    throw redirect({
      to: '/swaps',
      replace: true,
      search: {
        state: 'pending',
        tier: [],
        deck: [],
        hero: [],
        confidenceMin: 0,
        confidenceMax: 100,
      },
    });
  },
  component: () => null,
});

// Re-export SwapsPage under the old name so that any existing imports of
// ReviewsPage from this module still type-check without updating every consumer.
export { SwapsPage as ReviewsPage } from './swaps';

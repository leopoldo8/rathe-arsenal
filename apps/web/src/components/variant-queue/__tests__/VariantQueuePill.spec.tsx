import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { jobsHolder } = vi.hoisted(() => ({ jobsHolder: { data: { jobs: [] as unknown[], etaSeconds: 0 } } }));
vi.mock('../../../api/variant-jobs', () => ({
  useVariantJobsQuery: () => ({ data: jobsHolder.data, isLoading: false }),
  hasActiveJobs: (d: { jobs: { status: string }[] }) => d.jobs.some((j) => j.status === 'pending' || j.status === 'running'),
}));
// Link mock so the panel renders without a router:
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { VariantQueuePill } from '../VariantQueuePill';

describe('VariantQueuePill', () => {
  beforeEach(() => { jobsHolder.data = { jobs: [], etaSeconds: 0 }; });

  it('shows aggregate progress and expands the panel on click', async () => {
    jobsHolder.data = { jobs: [{ jobId: 'j1', deckId: 42, deckName: 'Kayo Aggro', status: 'running', total: 45, completed: 30, failed: 0 }], etaSeconds: 120 } as never;
    render(<VariantQueuePill />);
    expect(screen.getByTestId('variant-queue-pill')).toHaveTextContent('30/45');
    await userEvent.click(screen.getByTestId('variant-queue-pill'));
    expect(screen.getByTestId('variant-queue-panel')).toHaveTextContent('Kayo Aggro');
  });

  it('renders nothing when there are no jobs', () => {
    jobsHolder.data = { jobs: [], etaSeconds: 0 } as never;
    render(<VariantQueuePill />);
    expect(screen.queryByTestId('variant-queue-pill')).not.toBeInTheDocument();
  });
});

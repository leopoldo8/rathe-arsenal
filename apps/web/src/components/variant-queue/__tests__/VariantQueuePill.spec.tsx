import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { jobsHolder } = vi.hoisted(() => ({ jobsHolder: { data: { jobs: [] as unknown[], etaSeconds: 0 } } }));
vi.mock('../../../api/variant-jobs', () => ({
  useVariantJobsQuery: () => ({ data: jobsHolder.data, isLoading: false }),
  hasActiveJobs: (d: { jobs: { status: string }[] }) => d.jobs.some((j) => j.status === 'pending' || j.status === 'running'),
}));
// Link mock so the drawer renders without a router:
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { VariantQueuePill } from '../VariantQueuePill';

describe('VariantQueuePill', () => {
  beforeEach(() => { jobsHolder.data = { jobs: [], etaSeconds: 0 }; });

  it('opens the drawer on click and shows live progress for a running job', async () => {
    jobsHolder.data = { jobs: [{ jobId: 'j1', deckId: 42, deckName: 'Kayo Aggro', status: 'running', total: 45, completed: 30, failed: 0 }], etaSeconds: 120 } as never;
    render(<VariantQueuePill />);
    const button = screen.getByTestId('variant-queue-pill');
    expect(button).toHaveAttribute('data-status', 'active');
    await userEvent.click(button);
    const panel = screen.getByTestId('variant-queue-panel');
    expect(panel).toHaveTextContent('Kayo Aggro');
    expect(panel).toHaveTextContent('30/45');
    expect(panel).toHaveTextContent('Em andamento');
  });

  it('groups queued jobs separately from completed/failed ones', async () => {
    jobsHolder.data = { jobs: [
      { jobId: 'q1', deckId: 1, deckName: 'Waiting Deck', status: 'pending', total: 10, completed: 0, failed: 0 },
      { jobId: 'd1', deckId: 2, deckName: 'Failed Deck', status: 'failed', total: 5, completed: 0, failed: 5 },
    ], etaSeconds: 15 } as never;
    render(<VariantQueuePill />);
    await userEvent.click(screen.getByTestId('variant-queue-pill'));
    const panel = screen.getByTestId('variant-queue-panel');
    expect(panel).toHaveTextContent('Na fila');
    expect(panel).toHaveTextContent('Waiting Deck');
    expect(panel).toHaveTextContent('Concluído recentemente');
    expect(panel).toHaveTextContent(/Não foi possível alcançar a loja/i);
  });

  it('renders nothing when there are no jobs', () => {
    jobsHolder.data = { jobs: [], etaSeconds: 0 } as never;
    render(<VariantQueuePill />);
    expect(screen.queryByTestId('variant-queue-pill')).not.toBeInTheDocument();
  });

  it('opens the drawer when an external open request fires (Get exact prices)', async () => {
    jobsHolder.data = { jobs: [{ jobId: 'j1', deckId: 42, deckName: 'Kayo Aggro', status: 'running', total: 18, completed: 0, failed: 0 }], etaSeconds: 27 } as never;
    const { requestOpenVariantQueueDrawer } = await import('../variantQueueDrawerBus');
    render(<VariantQueuePill />);
    // Drawer starts closed (button visible, panel absent).
    expect(screen.queryByTestId('variant-queue-panel')).not.toBeInTheDocument();
    await act(async () => { requestOpenVariantQueueDrawer(); });
    expect(screen.getByTestId('variant-queue-panel')).toHaveTextContent('Kayo Aggro');
  });
});

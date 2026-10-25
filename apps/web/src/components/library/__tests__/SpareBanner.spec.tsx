import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers, response } from '../../spare/__tests__/spareKit';
import type { ISpareResponse } from '../../../api/spare';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { SpareBanner } from '../SpareBanner';

function renderBanner(data: ISpareResponse): void {
  api.fetch.mockResolvedValue(data);
  render(
    <Providers>
      <SpareBanner />
    </Providers>,
  );
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('SpareBanner', () => {
  it('the banner names spare copies with no number and opens Sobrando', async () => {
    renderBanner(response());

    const banner = await screen.findByTestId('spare-banner');
    expect(banner).toHaveTextContent('Você tem cópias sobrando');
    expect(banner).toHaveTextContent('Ver');
    expect(banner.textContent).not.toMatch(/\d/);
    expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '/spare');
  });

  it('shows while the count still waits for the rule', async () => {
    renderBanner(response({ needsRule: true, rule: null, rows: [], totalSpare: 0 }));

    expect(await screen.findByTestId('spare-banner')).toBeInTheDocument();
  });

  it('is absent when there are no spare rows', async () => {
    renderBanner(response({ rows: [], totalSpare: 0 }));

    await vi.waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('spare-banner')).toBeNull();
  });
});

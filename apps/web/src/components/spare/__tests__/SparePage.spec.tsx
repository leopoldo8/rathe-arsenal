import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DUDA_ROWS, Providers, response } from './spareKit';
import type { ISpareResponse } from '../../../api/spare';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));

import { SparePage } from '../SparePage';

async function renderPage(data: ISpareResponse): Promise<void> {
  api.fetch.mockImplementation(async (path: string) => {
    if (path === '/collection/spare') return data;
    throw new Error(`unhandled ${path}`);
  });
  render(
    <Providers>
      <SparePage onBack={vi.fn()} />
    </Providers>,
  );
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('SparePage (S20)', () => {
  it('shows no rule question when the count does not depend on it', async () => {
    await renderPage(response({ rule: null, needsRule: false, counts: { within_format: 20, any_deck: 20, per_deck: 20 } }));

    expect(await screen.findByTestId('spare-page')).toBeInTheDocument();
    expect(screen.getAllByTestId('spare-row')).toHaveLength(DUDA_ROWS.length);
    expect(screen.queryByText('Antes de contar o que sobra')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText(/Sua regra/)).toBeNull();
  });

  it('asks the rule question instead of any number while it is owed', async () => {
    await renderPage(response({ needsRule: true, rule: null, rows: [], totalSpare: 0 }));

    expect(await screen.findByText('Antes de contar o que sobra')).toBeInTheDocument();
    expect(screen.queryByTestId('spare-row')).toBeNull();
    expect(screen.queryByText(/Sobrando ·/)).toBeNull();
  });
});

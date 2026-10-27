import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ICsvSource } from '../../../api/csv-sources';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => (
    <a href={Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to)} className={className}>
      {children}
    </a>
  ),
}));

const sourcesQuery = vi.fn();
vi.mock('../../../api/csv-sources', () => ({
  useCsvSourcesQuery: () => sourcesQuery(),
  usePatchCsvSourceMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCsvSourceMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewDeleteCsvSource: () => vi.fn(),
  useUploadCsvMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../../api/collection-imports', () => ({
  usePendingLinesQuery: () => ({
    data: {
      imports: [
        {
          sourceId: 'lucas',
          label: 'colecao-lucas.csv',
          lines: Array.from({ length: 11 }, (_unused, index) => ({ id: index + 1 })),
        },
      ],
    },
  }),
}));

vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import { LibraryCsvSourcesPage } from '../../../routes/_auth/library-csv-sources';

function source(overrides: Partial<ICsvSource>): ICsvSource {
  return {
    id: 'id',
    userId: 'u',
    kind: 'csv',
    label: null,
    originalFilename: null,
    sourceUrl: null,
    contentHash: null,
    cardCount: 1,
    copies: 1,
    active: true,
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
    ...overrides,
  };
}

const IMPORTS: readonly ICsvSource[] = [
  source({ id: 'kayo', kind: 'product', label: 'Armory Deck: Kayo', copies: 66 }),
  source({ id: 'lucas', label: 'colecao-lucas.csv', copies: 612 }),
  source({ id: 'colada', kind: 'paste', label: 'Lista colada em 21/10', copies: 12 }),
  source({ id: 'mao', kind: 'manual', label: 'Manual entries', copies: 4 }),
];

describe('CsvSourceList', () => {
  beforeEach(() => {
    sourcesQuery.mockReturnValue({ isLoading: false, isError: false, data: IMPORTS });
  });

  it('matches r3-imports-phone copy and order', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LibraryCsvSourcesPage />
      </QueryClientProvider>,
    );

    const note = screen.getByText(
      'Se a mesma carta aparece em duas importações, as quantidades somam. Desligue uma importação que repete cartas que você já tinha.',
    );
    const back = screen.getByRole('link', { name: /Coleção/ });
    const heading = screen.getByRole('heading', { level: 1 });
    expect(back).toHaveTextContent('‹ Coleção');
    expect(heading).toHaveTextContent('Importações');
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
      'Armory Deck: Kayo · 66 cópias',
      'colecao-lucas.csv · 612 cópias · 11 para resolver',
      'Lista colada em 21/10 · 12 cópias',
      'Entradas à mão · 4 cópias',
    ]);

    const order = [back, heading, note, ...rows];
    order.slice(1).forEach((node, index) => {
      expect(order[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getAllByText(/as quantidades somam/)).toHaveLength(1);
    rows.forEach((row) => {
      expect(within(row).getByRole('link', { name: 'Versões desta importação' })).toBeInTheDocument();
    });
    expect(within(rows[3]!).getByText('Sempre incluídas')).toBeInTheDocument();
    expect(within(rows[3]!).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(rows[0]!).getByRole('switch')).toBeInTheDocument();
  });
});

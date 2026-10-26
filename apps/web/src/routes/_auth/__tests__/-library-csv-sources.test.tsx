/**
 * /library-csv-sources ("Importações") — one row per import incl. the manual one, the summing note, centred column.
 * The screen itself is r3-imports-phone, asserted in components/csv-sources/__tests__/CsvSourceList.spec.tsx.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '../../../test/i18n-test-utils';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => vi.fn(),
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

const sourcesQuery = vi.fn();
vi.mock('../../../api/csv-sources', () => ({
  useCsvSourcesQuery: () => sourcesQuery(),
  usePatchCsvSourceMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCsvSourceMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePreviewDeleteCsvSource: () => vi.fn(),
}));

vi.mock('../../../api/collection-imports', () => ({
  usePendingLinesQuery: () => ({ data: { imports: [] } }),
}));
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

import { LibraryCsvSourcesPage } from '../library-csv-sources';
import styles from '../library-csv-sources.module.css';
import type { ICsvSource } from '../../../api/csv-sources';

function build(overrides: Partial<ICsvSource>): ICsvSource {
  return {
    id: 'id',
    userId: 'u',
    kind: 'csv',
    label: 'Planilha',
    originalFilename: null,
    sourceUrl: null,
    contentHash: null,
    cardCount: 10,
    copies: 10,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

const FOUR_SOURCES: readonly ICsvSource[] = [
  build({ id: 'a', label: 'Minha planilha' }),
  build({ id: 'b', label: 'Fabrary: Rhinar', sourceUrl: 'https://fabrary.net/decks/X' }),
  build({ id: 'c', kind: 'manual', label: 'Manual entries', cardCount: 5 }),
  build({ id: 'd', label: 'Planilha antiga', active: false }),
];

function renderPage(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LibraryCsvSourcesPage />
    </QueryClientProvider>,
  );
}

describe('LibraryCsvSourcesPage', () => {
  beforeEach(() => {
    sourcesQuery.mockReturnValue({ isLoading: false, isError: false, data: FOUR_SOURCES });
  });

  it('renders every source row, including the manual one with no toggle', () => {
    renderPage();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Entradas à mão')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
  });

  it('says the summing rule once, under the heading, and no longer counts the sources', () => {
    renderPage();
    expect(
      screen.getAllByText(/Se a mesma carta aparece em duas importações, as quantidades somam/),
    ).toHaveLength(1);
    expect(screen.queryByText(/\d+ fontes?, \d+ em uso/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cartas no total/)).not.toBeInTheDocument();
  });

  it('localizes the heading and the note under en-US', async () => {
    await setTestLocale('en-US');
    renderPage();
    expect(screen.getByRole('heading', { name: 'Imports' })).toBeInTheDocument();
    expect(screen.getByText(/If the same card appears in two imports, the quantities add up/)).toBeInTheDocument();
    expect(screen.getByText('Hand entries', { selector: 'span' })).toBeInTheDocument();
  });

  it('links back to the collection and renders no list for an empty one', () => {
    sourcesQuery.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderPage();
    expect(screen.getByRole('link', { name: /Coleção/ })).toHaveAttribute('href', '/library');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('the page has one main', () => {
    // The app shell owns the page's one <main>; a stand-in wraps the page as the shell does.
    render(
      <main>
        <QueryClientProvider client={new QueryClient()}>
          <LibraryCsvSourcesPage />
        </QueryClientProvider>
      </main>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('the page has one main: also while the imports load', () => {
    sourcesQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });

    renderPage();

    expect(screen.queryAllByRole('main')).toHaveLength(0);
  });

  it('wraps the page in the centred column class', () => {
    const { container } = renderPage();
    expect(container.firstElementChild).toHaveClass(styles.page!);
  });
});

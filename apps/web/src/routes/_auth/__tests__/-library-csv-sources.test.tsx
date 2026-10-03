/**
 * /library-csv-sources — count line, source rows incl. Manual, centred column.
 * Covers LIB-05 and the container side of LIB-06.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '../../../test/i18n-test-utils';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: unknown) => config,
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

const libraryQuery = vi.fn();
vi.mock('../../../api/library', () => ({
  useLibraryQuery: () => libraryQuery(),
  LIBRARY_QUERY_KEY: ['library'],
}));

vi.mock('../../../components/csv-sources/UploadCsvButton', () => ({
  UploadCsvButton: () => <button type="button">Enviar CSV</button>,
}));
vi.mock('../../../components/library/RecentlyAddedBanner', () => ({
  RecentlyAddedBanner: () => null,
}));
vi.mock('../../../components/ui/Toast/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));
vi.mock('../../../utils/format-relative-time', () => ({
  formatRelativeTime: () => 'há 2 dias',
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
    libraryQuery.mockReturnValue({ data: { stats: { totalCopies: 389 } } });
  });

  it('states how many sources exist and how many are active', () => {
    renderPage();
    expect(screen.getByText('4 fontes · 3 ativas')).toBeInTheDocument();
  });

  it('takes the combined card total from the library stats, not from summing rows', () => {
    renderPage();
    expect(screen.getByText('389 cartas somadas')).toBeInTheDocument();
  });

  it('omits the combined total while the library stats are not loaded', () => {
    libraryQuery.mockReturnValue({ data: undefined });
    renderPage();
    expect(screen.getByText('4 fontes · 3 ativas')).toBeInTheDocument();
    expect(screen.queryByText(/cartas somadas/)).not.toBeInTheDocument();
  });

  it('localizes the count line under en-US', async () => {
    await setTestLocale('en-US');
    renderPage();
    expect(screen.getByText('4 sources · 3 active')).toBeInTheDocument();
    expect(screen.getByText('389 cards combined')).toBeInTheDocument();
  });

  it('renders every source row, including the Manual one with no toggle', () => {
    renderPage();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Entradas manuais')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
  });

  it('shows one type badge per row kind', () => {
    renderPage();
    expect(screen.getAllByText('CSV', { selector: 'span' })).toHaveLength(2);
    expect(screen.getAllByText('Fabrary', { selector: 'span' })).toHaveLength(1);
    expect(screen.getAllByText('Manual', { selector: 'span' })).toHaveLength(1);
  });

  it('labels each non-manual row Ativa or Inativa', () => {
    renderPage();
    expect(screen.getAllByText('Ativa', { selector: 'span' })).toHaveLength(2);
    expect(screen.getAllByText('Inativa', { selector: 'span' })).toHaveLength(1);
  });

  it('collapses the explainer to the one-line note by default', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: 'ⓘ Duplicatas entre fontes são somadas, não sobrescritas.' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('links back to the library and renders no count line for an empty list', () => {
    sourcesQuery.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderPage();
    expect(screen.getByRole('link', { name: /Biblioteca/ })).toHaveAttribute('href', '/library');
    expect(screen.queryByText(/fontes ·/)).not.toBeInTheDocument();
  });

  it('wraps the page in the centred column class', () => {
    const { container } = renderPage();
    expect(container.firstElementChild).toHaveClass(styles.page!);
  });
});

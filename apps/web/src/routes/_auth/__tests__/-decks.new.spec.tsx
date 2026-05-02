/**
 * Smoke tests for /decks/new (DecksNewPage).
 *
 * Covers:
 *  - Renders title and URL input form
 *  - Rejects invalid URL without calling the mutation
 *  - Calls useImportDecksMutation with the correct payload on valid URL
 *  - Renders the back-to-home link
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks for TanStack Router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => ({
    useSearch: () => ({}),
  }),
  useNavigate: () => mockNavigate,
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => <a href={to} className={className}>{children}</a>,
}));

// ---------------------------------------------------------------------------
// Mock useImportDecksMutation
// ---------------------------------------------------------------------------

const importMutate = vi.fn();

vi.mock('../../../api/decks', () => ({
  useImportDecksMutation: () => ({
    mutate: importMutate,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { DecksNewPage } from '../decks.new';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <DecksNewPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecksNewPage — /decks/new', () => {
  beforeEach(() => {
    importMutate.mockReset();
    mockNavigate.mockReset();
  });

  it('renders title and Fabrary URL input form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /track a deck/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Fabrary deck URL/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /track deck/i })).toBeInTheDocument();
  });

  it('renders the back-to-home link', () => {
    renderPage();
    const back = screen.getByRole('link', { name: /home/i });
    expect(back).toHaveAttribute('href', '/home');
  });

  it('rejects an invalid URL without calling the mutation', async () => {
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    await userEvent.type(input, 'not-a-url');
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    expect(importMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Not a valid Fabrary deck URL/i)).toBeInTheDocument();
  });

  it('calls the import mutation with urls array when a valid URL is submitted', async () => {
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    expect(importMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ['https://fabrary.net/decks/01HABCDEFG12345'],
      }),
      expect.any(Object),
    );
  });
});

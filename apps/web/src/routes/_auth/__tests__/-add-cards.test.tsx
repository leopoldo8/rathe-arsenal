/**
 * Tests for the /add-cards gallery + the Fabrary subview's URL handling.
 * The Manual + CSV subviews lean on already-tested mutations
 * (useAddCardMutation, useUploadCsvMutation), so the gallery + the new
 * Fabrary path get the dedicated coverage here.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks for TanStack router
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
// Mocks for the Fabrary import API hook (so we don't hit the network)
// ---------------------------------------------------------------------------

const fabraryMutate = vi.fn();
const fabraryMutationState: {
  isPending: boolean;
  data: unknown;
} = { isPending: false, data: null };

vi.mock('../../../api/fabrary-import', () => ({
  useFabraryLibraryImportMutation: () => ({
    mutate: fabraryMutate,
    isPending: fabraryMutationState.isPending,
  }),
}));

// ---------------------------------------------------------------------------
// Imports under test (after the vi.mock declarations)
// ---------------------------------------------------------------------------

import { AddCardsPage } from '../add-cards.index';
import { AddCardsFabraryPage } from '../add-cards.fabrary';

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderInRouter(node: React.ReactNode): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      {node}
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// /add-cards (gallery)
// ---------------------------------------------------------------------------

describe('AddCardsPage — gallery', () => {
  it('renders the page title and subtitle', () => {
    renderInRouter(<AddCardsPage />);
    expect(screen.getByRole('heading', { name: /^Add cards$/i })).toBeInTheDocument();
    expect(screen.getByText(/Three ways to grow your arsenal/i)).toBeInTheDocument();
  });

  it('renders three method cards as links to the matching subroutes', () => {
    renderInRouter(<AddCardsPage />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/add-cards/manual');
    expect(hrefs).toContain('/add-cards/csv');
    expect(hrefs).toContain('/add-cards/fabrary');
    expect(hrefs).toContain('/library-csv-sources');
  });

  it('renders each method numeral (I, II, III)', () => {
    renderInRouter(<AddCardsPage />);
    const numerals = screen.getAllByText(/^(I|II|III)$/);
    // The eyebrow "Three paths" includes a diamond, not a numeral —
    // each method card supplies exactly one.
    expect(numerals).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// /add-cards/fabrary (new endpoint consumer)
// ---------------------------------------------------------------------------

describe('AddCardsFabraryPage', () => {
  beforeEach(() => {
    fabraryMutate.mockReset();
    fabraryMutationState.isPending = false;
  });

  it('rejects an obviously invalid URL on submit', async () => {
    renderInRouter(<AddCardsFabraryPage />);
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    await userEvent.type(input, 'not-a-url');
    await userEvent.click(screen.getByRole('button', { name: /Import to library/i }));
    expect(fabraryMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Not a valid Fabrary deck URL/i),
    ).toBeInTheDocument();
  });

  it('calls the import mutation when a valid URL is submitted', async () => {
    renderInRouter(<AddCardsFabraryPage />);
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /Import to library/i }));
    expect(fabraryMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://fabrary.net/decks/01HABCDEFG12345',
      }),
      expect.any(Object),
    );
  });

  it('disables the submit button while submitting', () => {
    fabraryMutationState.isPending = true;
    renderInRouter(<AddCardsFabraryPage />);
    fabraryMutationState.isPending = false; // restore for next test
    const button = screen.getByRole('button', { name: /Import to library/i });
    expect(button).toBeDisabled();
  });

  it('Enter on the input triggers submission when the URL is valid', async () => {
    renderInRouter(<AddCardsFabraryPage />);
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fabraryMutate).toHaveBeenCalled());
  });

  it('renders the back-to-add-cards link', () => {
    renderInRouter(<AddCardsFabraryPage />);
    const back = screen.getByRole('link', { name: /Add cards/i });
    expect(back).toHaveAttribute('href', '/add-cards');
  });
});

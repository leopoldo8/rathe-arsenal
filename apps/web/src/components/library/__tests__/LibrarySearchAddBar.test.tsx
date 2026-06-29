/**
 * Tests for LibrarySearchAddBar.
 *
 * LibrarySearchAddBar is a thin wrapper around DeckCardSearchAutocomplete
 * (post-U10 extraction). These tests verify user-facing behavior is preserved:
 *  - Renders the search input with the library label
 *  - Does not render a slot picker (library usage never needs slot selection)
 *  - Calls useAddCardMutation when a card is picked
 *  - Shows an error alert when mutation fails
 *  - Forwards inputRef to the underlying input
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ISearchCardResult } from '../../../api/catalog';
import { LibrarySearchAddBar } from '../LibrarySearchAddBar';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSearchResult: ISearchCardResult = {
  cardIdentifier: 'briar-wizard-of-the-black-oak',
  name: 'Briar',
  pitch: 1,
  classes: ['Druid'],
  types: ['Hero'],
  ownedQuantity: 1,
  imageUrl: null,
  legalFormats: ['CC', 'Blitz'],
  legalHeroes: [],
  bannedFormats: [],
};

let mockSearchData: { results: ISearchCardResult[] } | undefined = undefined;
let mockIsSuccess = false;

vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: () => ({
    data: mockSearchData,
    isFetching: false,
    isSuccess: mockIsSuccess,
  }),
}));

const mockMutate = vi.fn();
let mockMutationIsError = false;

vi.mock('../../../api/collection', () => ({
  useAddCardMutation: () => ({
    mutate: mockMutate,
    isError: mockMutationIsError,
  }),
}));

const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  };
});

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

function renderBar(props: Partial<React.ComponentProps<typeof LibrarySearchAddBar>> = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <LibrarySearchAddBar {...props} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibrarySearchAddBar — rendering', () => {
  beforeEach(() => {
    mockSearchData = undefined;
    mockIsSuccess = false;
    mockMutationIsError = false;
    vi.clearAllMocks();
  });

  it('renders a search input labeled "Search and add cards to your library"', () => {
    renderBar();
    expect(
      screen.getByLabelText(/buscar e adicionar cards à biblioteca/i),
    ).toBeInTheDocument();
  });

  it('does not render a slot picker (library does not need slot selection)', () => {
    renderBar();
    expect(screen.queryByRole('group', { name: /deck slot/i })).not.toBeInTheDocument();
  });

  it('renders an error alert when mutation fails', () => {
    mockMutationIsError = true;
    renderBar();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/falha ao adicionar o card/i);
  });
});

describe('LibrarySearchAddBar — interaction (user picks a card)', () => {
  beforeEach(() => {
    mockSearchData = { results: [mockSearchResult] };
    mockIsSuccess = true;
    mockMutationIsError = false;
    vi.clearAllMocks();
  });

  it('calls useAddCardMutation.mutate when a card option is clicked', async () => {
    renderBar();
    const input = screen.getByLabelText(/buscar e adicionar cards à biblioteca/i);
    await userEvent.type(input, 'Br');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: /Briar/i });
    await userEvent.click(option);

    expect(mockMutate).toHaveBeenCalledWith(
      { cardIdentifier: 'briar-wizard-of-the-black-oak', quantity: 1 },
      expect.any(Object),
    );
  });

  it('calls onAdded callback via mutate onSuccess', () => {
    // Simulate mutate calling onSuccess immediately
    mockMutate.mockImplementation((_vars: unknown, options: { onSuccess?: () => void }) => {
      options.onSuccess?.();
    });

    const onAdded = vi.fn();
    renderBar({ onAdded });

    // Directly simulate a pick via input + click
    const input = screen.getByLabelText(/buscar e adicionar cards à biblioteca/i);
    userEvent.type(input, 'Br').then(async () => {
      await waitFor(() => screen.getByRole('listbox'));
      const option = screen.getByRole('option', { name: /Briar/i });
      await userEvent.click(option);
      expect(onAdded).toHaveBeenCalledWith('Briar');
    });
  });
});

describe('LibrarySearchAddBar — inputRef forwarding', () => {
  beforeEach(() => {
    mockSearchData = undefined;
    mockIsSuccess = false;
    mockMutationIsError = false;
    vi.clearAllMocks();
  });

  it('forwards inputRef to the underlying input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    renderBar({ inputRef: ref });
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('INPUT');
  });
});

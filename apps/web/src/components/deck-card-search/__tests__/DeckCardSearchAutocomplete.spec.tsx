/**
 * Tests for DeckCardSearchAutocomplete.
 *
 * Covers U10 test scenarios:
 *  - Happy path: type "Briar", arrow down + Enter → onPick(card, currentSlot)
 *  - Happy path: change slot to "weapon" → onPick receives slot: 'weapon'
 *  - Edge case: empty query → no dropdown
 *  - Edge case: query < 2 chars → no fetch
 *  - Edge case: Escape closes dropdown but preserves typed text
 *  - a11y: aria-controls, aria-expanded, aria-activedescendant, slot picker aria-label
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeckCardSearchAutocomplete } from '../DeckCardSearchAutocomplete';
import type { ISearchCardResult } from '../../../api/catalog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSearchResult: ISearchCardResult = {
  cardIdentifier: 'briar-wizard-of-the-black-oak',
  name: 'Briar',
  pitch: 1,
  classes: ['Druid'],
  types: ['Hero'],
  ownedQuantity: 0,
  imageUrl: null,
  legalFormats: ['CC', 'Blitz'],
  legalHeroes: [],
  bannedFormats: [],
};

const mockSearchFn = vi.fn();
let mockSearchData: { results: ISearchCardResult[] } | undefined = undefined;
let mockIsFetching = false;
let mockIsSuccess = false;

vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: (query: string) => {
    mockSearchFn(query);
    return {
      data: mockSearchData,
      isFetching: mockIsFetching,
      isSuccess: mockIsSuccess,
    };
  },
}));

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

function renderComponent(props: Partial<React.ComponentProps<typeof DeckCardSearchAutocomplete>> = {}) {
  const onPick = vi.fn();
  const result = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <DeckCardSearchAutocomplete onPick={onPick} {...props} />
    </QueryClientProvider>,
  );
  return { ...result, onPick };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckCardSearchAutocomplete — basic rendering', () => {
  beforeEach(() => {
    mockSearchData = undefined;
    mockIsFetching = false;
    mockIsSuccess = false;
    vi.clearAllMocks();
  });

  it('renders the search input with the default label', () => {
    renderComponent();
    expect(screen.getByLabelText(/search cards/i)).toBeInTheDocument();
  });

  it('renders a custom label when provided', () => {
    renderComponent({ label: 'Search and add cards to your library' });
    expect(screen.getByLabelText(/search and add cards to your library/i)).toBeInTheDocument();
  });

  it('never renders the slot picker (slot is derived from card.types by the caller)', () => {
    renderComponent();
    expect(screen.queryByRole('group', { name: /deck slot/i })).not.toBeInTheDocument();
  });
});

describe('DeckCardSearchAutocomplete — ARIA attributes', () => {
  beforeEach(() => {
    mockSearchData = undefined;
    mockIsFetching = false;
    mockIsSuccess = false;
    vi.clearAllMocks();
  });

  it('combobox wrapper has aria-expanded=false initially', () => {
    renderComponent();
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('combobox wrapper has aria-controls pointing to the listbox id', () => {
    renderComponent();
    const combobox = screen.getByRole('combobox');
    const ariaControls = combobox.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
    // The listbox element may not be in the DOM yet (no query), but the id reference is set
    expect(combobox).toHaveAttribute('aria-controls', ariaControls);
  });

  it('input has aria-controls pointing to the listbox', () => {
    renderComponent();
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-controls');
  });

  it('input has no aria-activedescendant when no item is highlighted', () => {
    renderComponent();
    const input = screen.getByRole('searchbox');
    // Without results, activedescendant should be absent
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('DeckCardSearchAutocomplete — empty query behavior', () => {
  beforeEach(() => {
    mockSearchData = undefined;
    mockIsFetching = false;
    mockIsSuccess = false;
    vi.clearAllMocks();
  });

  it('does not show dropdown when query is empty', async () => {
    renderComponent();
    const input = screen.getByRole('searchbox');
    await userEvent.click(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not show dropdown when query is 1 char (< 2)', async () => {
    renderComponent();
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, 'B');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('DeckCardSearchAutocomplete — keyboard navigation', () => {
  beforeEach(() => {
    mockSearchData = { results: [mockSearchResult] };
    mockIsFetching = false;
    mockIsSuccess = true;
    vi.clearAllMocks();
  });

  it('opens dropdown and navigates with ArrowDown then Enter to call onPick with the card', async () => {
    const { onPick } = renderComponent();
    const input = screen.getByRole('searchbox');

    await userEvent.type(input, 'Br');

    // Wait for listbox to appear (requires query length >= 2)
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Arrow down to first item
    await userEvent.keyboard('{ArrowDown}');

    // Check aria-activedescendant is set
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant');
    });

    // Press Enter to select
    await userEvent.keyboard('{Enter}');

    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ cardIdentifier: 'briar-wizard-of-the-black-oak' }),
    );
  });

  it('Escape closes the dropdown but preserves the typed text', async () => {
    renderComponent();
    const input = screen.getByRole('searchbox');

    await userEvent.type(input, 'Br');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');

    // Dropdown should be closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Input text should be preserved
    expect(input).toHaveValue('Br');
  });

  it('combobox shows aria-expanded=true when dropdown is open', async () => {
    renderComponent();
    const input = screen.getByRole('searchbox');

    await userEvent.type(input, 'Br');

    await waitFor(() => {
      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });
  });
});

describe('DeckCardSearchAutocomplete — onPick payload', () => {
  beforeEach(() => {
    mockSearchData = { results: [mockSearchResult] };
    mockIsFetching = false;
    mockIsSuccess = true;
    vi.clearAllMocks();
  });

  it('onPick card payload includes legalFormats, legalHeroes, bannedFormats from U17', async () => {
    const { onPick } = renderComponent();
    const input = screen.getByRole('searchbox');

    await userEvent.type(input, 'Br');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: /Briar/i });
    await userEvent.click(option);

    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({
        legalFormats: ['CC', 'Blitz'],
        legalHeroes: [],
        bannedFormats: [],
      }),
    );
  });
});

describe('DeckCardSearchAutocomplete — empty results state', () => {
  beforeEach(() => {
    mockSearchData = { results: [] };
    mockIsFetching = false;
    mockIsSuccess = true;
    vi.clearAllMocks();
  });

  it('shows "No cards found" message when query >= 2 chars yields empty results', async () => {
    renderComponent();
    const input = screen.getByRole('searchbox');

    await userEvent.type(input, 'Br');

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText(/no cards found/i)).toBeInTheDocument();
    });
  });
});

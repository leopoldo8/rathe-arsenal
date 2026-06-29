/**
 * Tests for ImportFabraryCard — success, error, and skipped handling.
 *
 * Focus: the card must surface a clear error instead of silently
 * redirecting to /home when the import returns errors or skips. It should
 * only navigate to the deck detail page when a deck was actually imported.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportFabraryCard } from '../ImportFabraryCard';
import type { IImportDecksResponse } from '../../../api/decks';

const { mockNavigate, mockMutate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMutate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../api/decks', () => ({
  useImportDecksMutation: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('../../../lib/api-client', () => ({
  ApiError: class ApiError extends Error {},
}));

const VALID_URL = 'https://fabrary.net/decks/01KNQ1FHZ77B3FHT33DJY3RDX3';

const EMPTY_RESPONSE: IImportDecksResponse = {
  imported: [],
  skipped: [],
  errors: [],
};

/** Configures the mutate mock to synchronously resolve with `result`. */
function resolveImportWith(result: IImportDecksResponse): void {
  mockMutate.mockImplementation((_vars, opts) => {
    opts?.onSuccess?.(result);
  });
}

function submitUrl(url: string): void {
  fireEvent.change(screen.getByLabelText('URL do baralho do Fabrary'), {
    target: { value: url },
  });
  fireEvent.click(screen.getByRole('button', { name: /rastrear baralho/i }));
}

describe('ImportFabraryCard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockMutate.mockReset();
  });

  it('navigates to the deck detail page when a deck is imported', () => {
    resolveImportWith({
      ...EMPTY_RESPONSE,
      imported: [
        {
          trackedDeckId: 42,
          name: 'Test Deck',
          hero: 'Blaze, Firemind',
          format: 'Silver Age',
          readinessSnapshot: null,
        },
      ],
    });

    render(<ImportFabraryCard />);
    submitUrl(VALID_URL);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/decks/$deckId',
      params: { deckId: '42' },
      search: { edit: undefined },
    });
  });

  it('shows an error and does NOT redirect to home when the import returns an error', () => {
    resolveImportWith({
      ...EMPTY_RESPONSE,
      errors: [
        {
          url: VALID_URL,
          code: 'FETCH_FAILED',
          message: 'Expected a fabrary.net host, got www.fabrary.net',
        },
      ],
    });

    render(<ImportFabraryCard />);
    submitUrl(VALID_URL);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an "already tracking" message and does NOT redirect to home when skipped', () => {
    resolveImportWith({
      ...EMPTY_RESPONSE,
      skipped: [{ url: VALID_URL, reason: 'ALREADY_TRACKED' }],
    });

    render(<ImportFabraryCard />);
    submitUrl(VALID_URL);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/acompanhando este baralho/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows an error and does NOT redirect to home for an unexpected empty response', () => {
    resolveImportWith(EMPTY_RESPONSE);

    render(<ImportFabraryCard />);
    submitUrl(VALID_URL);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

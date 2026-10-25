/**
 * Tests for ImportFabraryCard: the link is found in whatever is pasted, the player says whose cards
 * they are, and the deck opens only after the import answered with a deck.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportFabraryCard } from '../ImportFabraryCard';
import { ApiError } from '../../../lib/api-client';

const { mockNavigate, mockMutate, previewState, importState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockMutate: vi.fn(),
  previewState: vi.fn(),
  importState: { isPending: false, isError: false, error: null as unknown },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('../../../api/fabrary-import', () => ({
  useFabraryPreviewQuery: () => previewState(),
  useImportFabraryDeckMutation: () => ({ mutate: mockMutate, ...importState }),
}));

const VALID_URL = 'https://fabrary.net/decks/01KNQ1FHZ77B3FHT33DJY3RDX3';

const FOUND = {
  isPending: false,
  isError: false,
  error: null,
  data: { name: 'Test Deck', hero: 'Blaze, Firemind', format: 'Silver Age', totalCards: 60, ownedCards: 12 },
};

function typeUrl(url: string): void {
  fireEvent.change(screen.getByLabelText('Link do deck no Fabrary'), { target: { value: url } });
}

function importAs(answer: RegExp): void {
  fireEvent.click(screen.getByRole('radio', { name: answer }));
  fireEvent.click(screen.getByRole('button', { name: 'Importar o deck' }));
}

describe('ImportFabraryCard', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockMutate.mockReset();
    previewState.mockReturnValue(FOUND);
    importState.isPending = false;
    importState.isError = false;
    importState.error = null;
  });

  it('asks whose cards they are and sends the answer with the pasted text', () => {
    mockMutate.mockImplementation((_variables, options) => options?.onSuccess?.({ deckId: 42 }));
    render(<ImportFabraryCard />);
    typeUrl(`olha ${VALID_URL}`);

    expect(screen.getByText('Você tem 12 de 60 cartas deste deck')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar o deck' })).toBeDisabled();
    importAs(/^Não/);

    expect(mockMutate.mock.calls[0]![0]).toEqual({ text: `olha ${VALID_URL}`, ownsCards: false });
  });

  it('opens the deck once the import answered with it, whichever the answer', () => {
    mockMutate.mockImplementation((_variables, options) => options?.onSuccess?.({ deckId: 42 }));
    render(<ImportFabraryCard />);
    typeUrl(VALID_URL);
    importAs(/^Não/);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/decks/$deckId',
      params: { deckId: '42' },
      search: { edit: undefined },
    });
  });

  it('refuses text with no Fabrary link without asking the server', () => {
    render(<ImportFabraryCard />);
    typeUrl('not-a-url');

    expect(screen.getByRole('alert')).toHaveTextContent('Esse não é um link de deck do Fabrary');
    expect(screen.queryByRole('button', { name: 'Importar o deck' })).not.toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows a missing or private deck and does not redirect', () => {
    previewState.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      error: new ApiError(404, JSON.stringify({ code: 'FABRARY_DECK_NOT_FOUND' })),
    });
    render(<ImportFabraryCard />);
    typeUrl(VALID_URL);

    expect(screen.getByRole('alert')).toHaveTextContent('Esse deck não existe ou é privado no Fabrary.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('ImportFabraryCard: error callout danger treatment (UXUI-10)', () => {
  it('the not-a-link callout carries the danger-family CSS class (errorCallout, not infoBox)', () => {
    render(<ImportFabraryCard />);
    typeUrl('not-a-url');
    expect(screen.getByRole('alert').className).toContain('errorCallout');
  });
});

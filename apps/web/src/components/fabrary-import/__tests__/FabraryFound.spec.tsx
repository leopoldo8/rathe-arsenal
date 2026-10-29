import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import { peekPastedList, setPastedList } from '../../../lib/pasted-list';

const navigate = vi.fn();
const importMutate = vi.fn();
const previewState = vi.fn();
const importState = { isPending: false, isError: false, error: null as unknown };

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../../../api/fabrary-import', () => ({
  useFabraryPreviewQuery: () => previewState(),
  useImportFabraryDeckMutation: () => ({ mutate: importMutate, ...importState }),
}));

import { AddCardsEntry } from '../../add-cards/AddCardsEntry';

const LINK = 'https://fabrary.net/decks/01J0Z8K4M2ABCDEFGHJKMNPQRS';
const PASTED = `olha meu deck ${LINK} valeu`;

const FOUND = {
  isPending: false,
  isError: false,
  error: null,
  data: { name: '[CC] Rhinar Brute', hero: 'Rhinar', format: 'Classic Constructed', totalCards: 66, ownedCards: 0 },
};

function pasteLink(text = PASTED): void {
  const box = screen.getByRole('textbox');
  fireEvent.change(box, { target: { value: text } });
}

beforeEach(() => {
  vi.clearAllMocks();
  importState.isPending = false;
  importState.isError = false;
  importState.error = null;
  previewState.mockReturnValue(FOUND);
  setPastedList('stale');
});

describe('FabraryFound', () => {
  it('matches r3-fabrary-found-phone and waits for an answer', () => {
    render(<AddCardsEntry />);
    pasteLink();

    expect(screen.getByRole('textbox')).toHaveValue(PASTED);
    expect(screen.getByText('Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas')).toBeInTheDocument();
    expect(screen.getByText('Você tem 0 de 66 cartas deste deck')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Essas cartas são suas?' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    const yes = screen.getByRole('radio', { name: 'Sim, colocar na minha coleção' });
    const no = screen.getByRole('radio', { name: 'Não, só quero comparar com o que eu tenho' });
    expect(yes).not.toBeChecked();
    expect(no).not.toBeChecked();
    const importButton = screen.getByRole('button', { name: 'Importar o deck' });
    expect(importButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Colar a lista do que eu tenho' })).toBeInTheDocument();

    const order = [
      screen.getByRole('textbox'),
      screen.getByText('Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas'),
      screen.getByText('Você tem 0 de 66 cartas deste deck'),
      group,
      importButton,
      screen.getByRole('button', { name: 'Colar a lista do que eu tenho' }),
    ];
    order.slice(1).forEach((node, index) => {
      expect(order[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    fireEvent.click(no);
    expect(importButton).toBeEnabled();
    expect(yes).not.toBeChecked();
  });

  it('a no answer imports only the deck and offers to paste a list', async () => {
    importMutate.mockImplementation((_variables: unknown, options: { onSuccess: (response: { deckId: number }) => void }) =>
      options.onSuccess({ deckId: 7 }),
    );
    render(<AddCardsEntry />);
    pasteLink();

    fireEvent.click(screen.getByRole('radio', { name: 'Não, só quero comparar com o que eu tenho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar o deck' }));

    expect(importMutate.mock.calls[0]![0]).toEqual({ text: PASTED, ownsCards: false });
    expect(navigate).not.toHaveBeenCalled();
    const paste = screen.getByRole('button', { name: 'Colar a lista do que eu tenho' });
    await userEvent.click(paste);
    expect(navigate).toHaveBeenCalledWith({ to: '/add-cards/list' });
    expect(peekPastedList()).toBe('');
  });

  it('a yes answer sends the answer and opens the deck', () => {
    importMutate.mockImplementation((_variables: unknown, options: { onSuccess: (response: { deckId: number }) => void }) =>
      options.onSuccess({ deckId: 7 }),
    );
    render(<AddCardsEntry />);
    pasteLink();

    fireEvent.click(screen.getByRole('radio', { name: 'Sim, colocar na minha coleção' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar o deck' }));

    expect(importMutate.mock.calls[0]![0]).toEqual({ text: PASTED, ownsCards: true });
    expect(navigate).toHaveBeenCalledWith({ to: '/decks/$deckId', params: { deckId: '7' }, search: { edit: undefined } });
  });

  it('a missing deck and an unreachable Fabrary say so', () => {
    previewState.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      error: new ApiError(404, JSON.stringify({ code: 'FABRARY_DECK_NOT_FOUND' })),
    });
    const { unmount } = render(<AddCardsEntry />);
    pasteLink();
    expect(screen.getByRole('alert')).toHaveTextContent('Esse deck não existe ou é privado no Fabrary.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/catálogo/i);
    unmount();

    previewState.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      error: new ApiError(502, JSON.stringify({ code: 'FABRARY_UNREACHABLE' })),
    });
    render(<AddCardsEntry />);
    pasteLink();
    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos falar com o Fabrary agora. Tente de novo em alguns minutos.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/catálogo/i);
  });

  it('an import that fails after the answer says why and keeps the card', () => {
    importState.isError = true;
    importState.error = new ApiError(502, JSON.stringify({ code: 'FABRARY_UNREACHABLE' }));
    render(<AddCardsEntry />);
    pasteLink();

    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos falar com o Fabrary agora.');
    expect(screen.getByRole('button', { name: 'Importar o deck' })).toBeInTheDocument();
  });
});

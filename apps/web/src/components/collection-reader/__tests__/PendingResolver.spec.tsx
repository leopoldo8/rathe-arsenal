import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IPendingLine, IPendingResponse, IReadImportResponse } from '../../../api/collection-imports';
import { makeLine } from './readerFixtures';

const pendingQuery = vi.fn();
const resolveMutate = vi.fn();
const deleteMutate = vi.fn();
const readMutate = vi.fn();
const navigate = vi.fn();

vi.mock('../../../api/collection-imports', () => ({
  usePendingLinesQuery: () => pendingQuery(),
  useResolvePendingMutation: () => ({ mutate: resolveMutate, isPending: false }),
  useDeletePendingMutation: () => ({ mutate: deleteMutate, isPending: false }),
  useReadImportMutation: () => ({ mutate: readMutate, isPending: false }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

import { PendingResolver } from '../PendingResolver';

const SNATCH = { cardIdentifier: 'snatch-red', name: 'Snatch', pitch: 1, imageUrl: null };
const SAVAGE = { cardIdentifier: 'savage-beatdown-red', name: 'Savage Beatdown', pitch: 1, imageUrl: null };

function line(overrides: Partial<IPendingLine> & { id: number; lineNumber: number; originalText: string }): IPendingLine {
  return { reason: 'not_found', quantityHint: null, options: null, suggestion: null, ...overrides };
}

const SUGGESTION_LINE = line({ id: 1, lineNumber: 12, originalText: 'Snach,2,Vermelho', reason: 'suggestion', quantityHint: 2, suggestion: SNATCH });
const UNKNOWN_LINE = line({ id: 2, lineNumber: 31, originalText: 'Mistery Card,1,' });
const QUANTITY_LINE = line({ id: 3, lineNumber: 141, originalText: 'Savage Beatdown,três,Vermelho', reason: 'bad_quantity', quantityHint: 3, suggestion: SAVAGE });

function withLines(...lines: IPendingLine[]): { data: IPendingResponse; isSuccess: true; isError: false } {
  return { data: { imports: [{ sourceId: 'a', label: 'colecao-lucas.csv', lines }] }, isSuccess: true, isError: false };
}

function succeedImmediately(vars: unknown, options?: { onSuccess?: () => void }): void {
  void vars;
  options?.onSuccess?.();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  resolveMutate.mockImplementation(succeedImmediately);
  deleteMutate.mockImplementation(succeedImmediately);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PendingResolver', () => {
  it('matches r4-resolve-b-phone for a near name', () => {
    pendingQuery.mockReturnValue(withLines(SUGGESTION_LINE, UNKNOWN_LINE, QUANTITY_LINE));
    render(<PendingResolver />);

    expect(screen.getByRole('link', { name: /Coleção/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sair e continuar depois' })).toBeInTheDocument();
    expect(screen.getByText('1 de 3')).toBeInTheDocument();
    expect(screen.getByText('colecao-lucas.csv · 2 depois desta')).toBeInTheDocument();
    expect(screen.getByText('Linha 12 do arquivo · lemos assim')).toBeInTheDocument();
    expect(screen.getByText('Snach,2,Vermelho')).toBeInTheDocument();
    expect(screen.getByText('Você quis dizer')).toBeInTheDocument();
    expect(screen.getByText('Snatch (Vermelho)')).toBeInTheDocument();
    expect(screen.getByText('Quantas cópias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar 2 Snatch (Vermelho)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Não é esta, buscar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir esta linha' })).toBeInTheDocument();
    expect(screen.getByText('Pular deixa a linha na lista. Ela volta na próxima vez que você abrir Resolver.')).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('arranges the three steps as r4-resolve-b-phone', () => {
    // 11 open lines with 2 already settled puts the near-name line at "3 de 11" with 8 after it.
    const filler = (id: number): IPendingLine => line({ id, lineNumber: id, originalText: `Filler ${id},1,`, reason: 'suggestion', quantityHint: 1, suggestion: SNATCH });
    pendingQuery.mockReturnValue(withLines(filler(101), filler(102), SUGGESTION_LINE, ...[103, 104, 105, 106, 107, 108].map(filler), UNKNOWN_LINE, QUANTITY_LINE));
    render(<PendingResolver />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 1 Snatch (Vermelho)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 1 Snatch (Vermelho)' }));

    const inOrder = (...elements: readonly HTMLElement[]): void => {
      elements.slice(1).forEach((element, index) => {
        const before = elements[index] as HTMLElement;
        expect(before.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING, `${before.textContent} then ${element.textContent}`).toBeTruthy();
      });
    };

    // Near-name step.
    expect(screen.getByText('3 de 11')).toBeInTheDocument();
    inOrder(
      screen.getByRole('link', { name: /Coleção/ }),
      screen.getByRole('link', { name: 'Sair e continuar depois' }),
      screen.getByText('3 de 11'),
      screen.getByText('colecao-lucas.csv · 8 depois desta · 2 já resolvidas'),
      screen.getByText('Linha 12 do arquivo · lemos assim'),
      screen.getByText('Snach,2,Vermelho'),
      screen.getByText('Você quis dizer'),
      screen.getByText('Snatch (Vermelho)'),
      screen.getByText('Quantas cópias'),
      screen.getByRole('button', { name: 'Menos uma cópia' }),
      screen.getByRole('button', { name: 'Mais uma cópia' }),
      screen.getByRole('button', { name: 'Adicionar 2 Snatch (Vermelho)' }),
      screen.getByRole('button', { name: 'Não é esta, buscar' }),
      screen.getByRole('button', { name: 'Pular' }),
      screen.getByRole('button', { name: 'Excluir esta linha' }),
      screen.getByText('Pular deixa a linha na lista. Ela volta na próxima vez que você abrir Resolver.'),
    );
    expect(screen.getByText('2')).toBeInTheDocument();

    // Unknown-word step: the search box comes right after the prompt, and Adicionar waits for a card.
    pendingQuery.mockReturnValue(withLines(UNKNOWN_LINE));
    cleanup();
    render(<PendingResolver />);
    inOrder(
      screen.getByText('Linha 31 do arquivo · lemos assim'),
      screen.getByText('Mistery Card,1,'),
      screen.getByText('Não achamos essa carta. Busque pelo nome.'),
      screen.getByRole('searchbox'),
      screen.getByRole('button', { name: 'Adicionar' }),
      screen.getByRole('button', { name: 'Pular' }),
      screen.getByRole('button', { name: 'Excluir esta linha' }),
    );
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    expect(screen.getByText('1')).toBeInTheDocument();

    // Unreadable-quantity step: the known card, then the sentence, then the stepper at 3.
    pendingQuery.mockReturnValue(withLines(QUANTITY_LINE));
    cleanup();
    render(<PendingResolver />);
    inOrder(
      screen.getByText('Linha 141 do arquivo · lemos assim'),
      screen.getByText('Savage Beatdown,três,Vermelho'),
      screen.getByText('Savage Beatdown (Vermelho)'),
      screen.getByText('"três" não é um número. Quantas cópias?'),
      screen.getByRole('button', { name: 'Adicionar 3 Savage Beatdown (Vermelho)' }),
      screen.getByRole('button', { name: 'Pular' }),
      screen.getByRole('button', { name: 'Excluir esta linha' }),
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('an unknown word centres on the search and keeps Adicionar off until a card is chosen', () => {
    pendingQuery.mockReturnValue(withLines(UNKNOWN_LINE));
    readMutate.mockImplementation((_input: unknown, options: { onSuccess: (r: IReadImportResponse) => void }) =>
      options.onSuccess({ columns: [], lines: [makeLine({ lineNumber: 1, originalText: 'Snatch', outcome: 'ready', cardIdentifier: 'snatch-red', name: 'Snatch', pitch: 1, quantity: 1 })] }),
    );
    render(<PendingResolver />);

    expect(screen.getByText('Linha 31 do arquivo · lemos assim')).toBeInTheDocument();
    expect(screen.getByText('Não achamos essa carta. Busque pelo nome.')).toBeInTheDocument();
    expect(screen.queryByText('Você quis dizer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir esta linha' })).toBeInTheDocument();
    // r4-resolve-b-phone draws the skip note under the near-name step only.
    expect(screen.queryByText('Pular deixa a linha na lista. Ela volta na próxima vez que você abrir Resolver.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Snatch' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(readMutate.mock.calls[0]![0]).toEqual({ text: 'Snatch' });
    const add = screen.getByRole('button', { name: 'Adicionar 1 Snatch (Vermelho)' });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(resolveMutate.mock.calls[0]![0]).toEqual({ id: 2, cardIdentifier: 'snatch-red', quantity: 1 });
  });

  it('a search with no card says so and adds nothing', () => {
    pendingQuery.mockReturnValue(withLines(UNKNOWN_LINE));
    readMutate.mockImplementation((_input: unknown, options: { onSuccess: (r: IReadImportResponse) => void }) =>
      options.onSuccess({ columns: [], lines: [makeLine({ lineNumber: 1, originalText: 'Mistery', outcome: 'not_found', quantity: 1 })] }),
    );
    render(<PendingResolver />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Mistery' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText('Nenhuma carta com esse nome. Tente só uma palavra.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('an unreadable quantity shows the known card and the stepper', () => {
    pendingQuery.mockReturnValue(withLines(QUANTITY_LINE));
    render(<PendingResolver />);

    expect(screen.getByText('Linha 141 do arquivo · lemos assim')).toBeInTheDocument();
    expect(screen.getByText('Savage Beatdown (Vermelho)')).toBeInTheDocument();
    expect(screen.getByText('"três" não é um número. Quantas cópias?')).toBeInTheDocument();
    expect(screen.queryByText('Você quis dizer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar 3 Savage Beatdown (Vermelho)' })).toBeEnabled();
    expect(screen.queryByText('Pular deixa a linha na lista. Ela volta na próxima vez que você abrir Resolver.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mais uma cópia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 4 Savage Beatdown (Vermelho)' }));
    expect(resolveMutate.mock.calls[0]![0]).toEqual({ id: 3, cardIdentifier: 'savage-beatdown-red', quantity: 4 });
  });

  it('Pular moves to the next line and the skipped line stays pending', () => {
    pendingQuery.mockReturnValue(withLines(SUGGESTION_LINE, UNKNOWN_LINE));
    render(<PendingResolver />);

    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));

    expect(screen.getByText('Linha 31 do arquivo · lemos assim')).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(resolveMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Excluir esta linha' }));
    expect(deleteMutate.mock.calls[0]![0]).toBe(2);
    expect(screen.getByText('Linha 12 do arquivo · lemos assim')).toBeInTheDocument();
  });

  it('counts resolved lines in the header and returns to the collection after the last one', () => {
    pendingQuery.mockReturnValue(withLines(SUGGESTION_LINE, QUANTITY_LINE));
    render(<PendingResolver />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 2 Snatch (Vermelho)' }));
    expect(screen.getByText('2 de 2')).toBeInTheDocument();
    expect(screen.getByText('colecao-lucas.csv · 1 já resolvida')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 3 Savage Beatdown (Vermelho)' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]![0]).toMatchObject({ to: '/library' });
  });

  it('keeps Adicionar disabled and the line pending when the save fails', () => {
    pendingQuery.mockReturnValue(withLines(SUGGESTION_LINE));
    resolveMutate.mockImplementation((_vars: unknown, options: { onError?: () => void }) => options.onError?.());
    render(<PendingResolver />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar 2 Snatch (Vermelho)' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(navigate).not.toHaveBeenCalled();
    within(document.body).getByText('Linha 12 do arquivo · lemos assim');
  });
});

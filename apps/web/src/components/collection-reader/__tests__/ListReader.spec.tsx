import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IReadLine, IReadImportResponse } from '../../../api/collection-imports';
import { LIST_LINES, LIST_PASTE, makeLine } from './readerFixtures';

const readMutate = vi.fn();
const createMutate = vi.fn();
const navigate = vi.fn();

vi.mock('../../../api/collection-imports', () => ({
  useReadImportMutation: () => ({ mutate: readMutate, isPending: false }),
  useCreateImportMutation: () => ({ mutate: createMutate, isPending: false }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

import { ListReader } from '../ListReader';

type TReadHandler = { onSuccess?: (response: IReadImportResponse) => void; onSettled?: () => void };

function answerReads(answers: Record<string, readonly IReadLine[]>): void {
  readMutate.mockImplementation((input: { text: string }, handlers?: TReadHandler) => {
    handlers?.onSuccess?.({ lines: answers[input.text] ?? [], columns: [] });
    handlers?.onSettled?.();
  });
}

async function renderPasted(): Promise<HTMLElement> {
  const { container } = render(<ListReader />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Lista de cartas' }), { target: { value: LIST_PASTE } });
  await screen.findByText(/Lemos 8 linhas/);
  return container;
}

function lineItem(number: number): HTMLElement {
  const item = screen.getAllByRole('listitem').find((candidate) => candidate.querySelector('span')?.textContent === String(number));
  if (item === undefined) throw new Error(`line ${number} not found`);
  return item;
}

describe('ListReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerReads({ [LIST_PASTE]: LIST_LINES, 'Command and Conquer': [makeLine({ lineNumber: 1, originalText: 'Command and Conquer', quantity: 1, cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', pitch: 1 })] });
  });

  it('matches r3-list-phone copy and order', async () => {
    const container = await renderPasted();
    await userEvent.click(within(lineItem(4)).getByRole('button', { name: 'Usar esta' }));

    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelector('textarea')?.remove();
    const text = clone.textContent ?? '';
    const inOrder = [
      'Adicionar cartas',
      'Lista colada',
      'Versão das cartas desta lista',
      'Não sei',
      'Sem foil · NM',
      'Escolher por linha',
      'Lemos 8 linhas: 6 prontas · 1 precisa de cor · 1 não achamos',
      '3 Snatch (Vermelho)',
      '3x Snatch (Red)',
      '2 Command and Conquer (Vermelho)',
      '1 Enlightened Strike (Vermelho)',
      'foil · existe em 2 versões foil: escolha',
      '1 Enlightened Strike foil',
      'Você aceitou: Command and Conquer (Vermelho) · Desfazer',
      '4 Pummel · Qual cor?',
      '2 Sink Below (Amarelo)',
      '3 Pack Hunt (Azul)',
      '"(3)" lido como Azul',
      'Não achamos "Mistery Card"',
      'Procurar',
      'Adicionar as 6 prontas (12 cópias)',
      'As 2 que faltam ficam em "Para resolver", no topo da sua coleção.',
    ].map((fragment) => ({ fragment, position: text.indexOf(fragment) }));
    expect(inOrder.filter((entry) => entry.position < 0)).toEqual([]);
    expect(inOrder.map((entry) => entry.position)).toEqual([...inOrder.map((entry) => entry.position)].sort((a, b) => a - b));
    expect(screen.getByRole('link', { name: /Adicionar cartas/ })).toHaveAttribute('href', '/add-cards');
    const colors = within(lineItem(5));
    expect(['Vermelho', 'Amarelo', 'Azul'].map((name) => colors.getByRole('button', { name }))).toHaveLength(3);
    expect(colors.queryByRole('button', { name: 'Não sei' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Lista de cartas' })).toHaveValue(LIST_PASTE);
  });

  it('a suggestion counts only after Usar esta', async () => {
    await renderPasted();

    expect(screen.getByRole('button', { name: 'Adicionar as 5 prontas (11 cópias)' })).toBeInTheDocument();
    expect(screen.getByText(/Você quis dizer/)).toHaveTextContent('Você quis dizer Command and Conquer (Vermelho)?');
    expect(screen.getByRole('button', { name: 'Corrigir' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Usar esta' }));

    expect(screen.getByRole('button', { name: 'Adicionar as 6 prontas (12 cópias)' })).toBeInTheDocument();
    expect(lineItem(4)).toHaveTextContent('Você aceitou: Command and Conquer (Vermelho) · Desfazer');
    expect(screen.getByText(/Lemos 8 linhas/)).toHaveTextContent('Lemos 8 linhas: 6 prontas · 1 precisa de cor · 1 não achamos');

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(screen.getByRole('button', { name: 'Adicionar as 5 prontas (11 cópias)' })).toBeInTheDocument();
    expect(screen.getByText(/Você quis dizer/)).toBeInTheDocument();
  });

  it('a line with no match offers edit and search', async () => {
    await renderPasted();
    const readsBefore = readMutate.mock.calls.length;
    const item = within(lineItem(8));

    expect(item.getByText('Não achamos "Mistery Card"')).toBeInTheDocument();
    const field = item.getByRole('textbox', { name: 'Texto da linha 8' });
    expect(field).toHaveValue('Mistery Card');

    await userEvent.clear(field);
    await userEvent.type(field, 'Command and Conquer');
    await userEvent.click(item.getByRole('button', { name: 'Procurar' }));

    expect(readMutate).toHaveBeenCalledTimes(readsBefore + 1);
    expect(readMutate.mock.calls[readsBefore]![0]).toEqual({ text: 'Command and Conquer' });
    await waitFor(() => expect(lineItem(8)).toHaveTextContent('1 Command and Conquer (Vermelho)'));
    expect(lineItem(8)).toHaveTextContent('Mistery Card');
    expect(lineItem(1)).toHaveTextContent('3 Snatch (Vermelho)');
    expect(screen.getByText(/Lemos 8 linhas/)).toHaveTextContent('6 prontas · 1 precisa de cor · 1 com nome parecido');
  });

  it('adding the ready lines keeps the rest for later', async () => {
    await renderPasted();
    await userEvent.click(within(lineItem(4)).getByRole('button', { name: 'Usar esta' }));

    expect(screen.getByText('As 2 que faltam ficam em "Para resolver", no topo da sua coleção.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar as 6 prontas (12 cópias)' }));

    expect(createMutate).toHaveBeenCalledTimes(1);
    const body = createMutate.mock.calls[0]![0];
    expect(body.kind).toBe('paste');
    expect(body.name).toMatch(/^Lista colada em /);
    expect(body.ready.map((line: { cardIdentifier: string; quantity: number }) => [line.cardIdentifier, line.quantity])).toEqual([
      ['snatch-red', 3],
      ['command-and-conquer-red', 2],
      ['enlightened-strike-red', 1],
      ['command-and-conquer-red', 1],
      ['sink-below-yellow', 2],
      ['pack-hunt-blue', 3],
    ]);
    expect(body.pending).toEqual([
      { lineNumber: 5, originalText: '4 Pummel', reason: 'asks_color', suggestedCardIdentifier: 'pummel-red' },
      { lineNumber: 8, originalText: 'Mistery Card', reason: 'not_found' },
    ]);
  });

  it('a chosen color makes the line ready', async () => {
    await renderPasted();

    await userEvent.click(within(lineItem(5)).getByRole('button', { name: 'Amarelo' }));

    expect(lineItem(5)).toHaveTextContent('4 Pummel (Amarelo)');
    expect(screen.getByRole('button', { name: 'Adicionar as 6 prontas (15 cópias)' })).toBeInTheDocument();
  });
});

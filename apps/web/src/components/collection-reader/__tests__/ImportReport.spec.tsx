import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../lib/api-client';
import { setTestLocale } from '../../../test/i18n-test-utils';
import type { IReadImportResponse, IReadLine } from '../../../api/collection-imports';
import { makeLine } from './readerFixtures';

const readMutate = vi.fn();
const createMutate = vi.fn();

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
  useNavigate: () => vi.fn(),
}));

import { ImportReport } from '../ImportReport';

function colorLine(lineNumber: number, originalText: string, name: string): IReadLine {
  const slug = name.toLowerCase().replace(/ /g, '-');
  return makeLine({
    lineNumber,
    originalText,
    outcome: 'asks_color',
    name,
    quantity: 1,
    options: [
      { kind: 'pitch', pitch: 1, cardIdentifier: `${slug}-red` },
      { kind: 'pitch', pitch: 2, cardIdentifier: `${slug}-yellow` },
      { kind: 'pitch', pitch: 3, cardIdentifier: `${slug}-blue` },
      { kind: 'unknown' },
    ],
  });
}

function similarLine(lineNumber: number, originalText: string, name: string, pitch: number): IReadLine {
  return makeLine({
    lineNumber,
    originalText,
    outcome: 'suggestion',
    suggestion: { cardIdentifier: `${name.toLowerCase().replace(/ /g, '-')}`, name, pitch, imageUrl: null },
  });
}

/** 289 ready lines holding 612 copies of 241 cards, and the 11 lines of `r3-report-phone` that wait. */
function reportLines(): IReadLine[] {
  const ready = Array.from({ length: 289 }, (_unused, index) =>
    makeLine({
      // Line 8 is the row with the unquoted comma; the 11 lines that wait use other numbers.
      lineNumber: index === 5 ? 8 : index + 2 + (index > 5 ? 1 : 0),
      originalText: `Card ${index},2,`,
      cardIdentifier: `card-${index % 241}`,
      name: `Card ${index % 241}`,
      pitch: 1,
      quantity: index < 34 ? 3 : 2,
      notes: index === 5 ? ['lemos "Rhinar, Reckless Rampage" certo'] : [],
    }),
  );
  return [
    ...ready,
    colorLine(23, 'Snatch,2,', 'Snatch'),
    colorLine(57, 'Pummel,1,', 'Pummel'),
    colorLine(64, 'Sink Below,3,', 'Sink Below'),
    colorLine(88, 'Pack Hunt,1,', 'Pack Hunt'),
    colorLine(102, 'Wounding Blow,2,', 'Wounding Blow'),
    colorLine(119, 'Head Jab,3,', 'Head Jab'),
    colorLine(203, 'Scar for a Scar,1,', 'Scar for a Scar'),
    similarLine(45, 'Enlightend Strike,3,Vermelho', 'Enlightened Strike', 1),
    similarLine(77, 'Bone Head Barier,2,Vermelho', 'Bone Head Barrier', 1),
    similarLine(168, 'Wrecker Rump,3,Azul', 'Wrecker Romp', 3),
    makeLine({
      lineNumber: 141,
      originalText: 'Savage Beatdown,três,Vermelho',
      outcome: 'bad_quantity',
      cardIdentifier: 'savage-beatdown-red',
      name: 'Savage Beatdown',
      pitch: 1,
      quantity: null,
      quantityRaw: 'três',
      suggestedQuantity: 3,
    }),
  ];
}

function answerWith(response: IReadImportResponse): void {
  readMutate.mockImplementation((_input: unknown, handlers?: { onSuccess?: (value: IReadImportResponse) => void }) => {
    handlers?.onSuccess?.(response);
  });
}

const FILE = new File(['nome,quantidade,cor'], 'colecao-lucas.csv', { type: 'text/csv' });

describe('ImportReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches r3-report-phone copy and order', () => {
    answerWith({ lines: reportLines(), columns: ['nome', 'quantidade', 'cor'] });

    const { container } = render(<ImportReport file={FILE} onChooseAnother={vi.fn()} />);

    const text = container.textContent ?? '';
    const inOrder = [
      'Adicionar cartas',
      'colecao-lucas.csv',
      '289 linhas prontas · 612 cópias (241 cartas)',
      'Lemos as colunas nome, quantidade e cor.',
      'Esta planilha não tem coluna de versão: as cartas entram sem versão informada.',
      'Linha 8: lemos "Rhinar, Reckless Rampage" certo.',
      '11 para resolver',
      'Sem cor',
      'Linha 23',
      'Snatch,2,',
      'Nome parecido',
      'Você quis dizer Enlightened Strike (Vermelho)?',
      'Usar esta',
      'Corrigir',
      'Quantidade',
      '"três" não é um número',
      'Usar 3',
      'Adicionar as 289 prontas',
      'As 11 que faltam ficam em "Para resolver", no topo da sua coleção.',
    ].map((fragment) => ({ fragment, position: text.indexOf(fragment) }));
    expect(inOrder.filter((entry) => entry.position < 0)).toEqual([]);
    expect(inOrder.map((entry) => entry.position)).toEqual([...inOrder.map((entry) => entry.position)].sort((a, b) => a - b));
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Sem cor7',
      'Nome parecido3',
      'Quantidade1',
    ]);
    const noColor = screen.getByRole('heading', { name: /Sem cor/ }).parentElement as HTMLElement;
    const items = within(noColor).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    for (const item of items) {
      expect(['Vermelho', 'Amarelo', 'Azul', 'Não sei'].map((name) => within(item).getByRole('button', { name }))).toHaveLength(4);
    }
    const quantityItem = within(screen.getByRole('heading', { name: /Quantidade/ }).parentElement as HTMLElement).getByRole('listitem');
    expect(within(quantityItem).getByRole('textbox', { name: 'Quantidade da linha 141' })).toHaveValue('3');
    expect(within(quantityItem).getByRole('button', { name: 'Usar 3' })).toBeEnabled();
    const similar = within(screen.getByRole('heading', { name: /Nome parecido/ }).parentElement as HTMLElement).getAllByRole('listitem');
    expect(similar).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Adicionar cartas/ })).toHaveAttribute('href', '/add-cards');
  });

  it('an unreadable file shows a localized error', async () => {
    const body = JSON.stringify({ statusCode: 400, error: 'The file is not text', code: 'IMPORT_UNREADABLE' });
    readMutate.mockImplementation((_input: unknown, handlers?: { onError?: (error: Error) => void }) => {
      handlers?.onError?.(new ApiError(400, body));
    });

    const { unmount } = render(<ImportReport file={FILE} onChooseAnother={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Não conseguimos ler esse arquivo.');
    expect(alert).toHaveTextContent('.csv');
    expect(alert.textContent).not.toContain('{');
    expect(screen.queryByRole('button', { name: /Adicionar as/ })).not.toBeInTheDocument();
    unmount();

    await setTestLocale('en-US');
    render(<ImportReport file={FILE} onChooseAnother={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('We could not read that file.');
    expect(screen.getByRole('alert').textContent).not.toContain('{');
  });

  it('adding the ready lines sends the rest as pending and a duplicate asks before adding again', async () => {
    answerWith({ lines: reportLines(), columns: ['nome', 'quantidade', 'cor'] });
    const duplicate = new ApiError(
      409,
      JSON.stringify({ code: 'DUPLICATE_IMPORT', details: { existingLabel: 'colecao-lucas.csv' } }),
    );
    createMutate.mockImplementation((_body: unknown, handlers?: { onError?: (error: Error) => void }) => {
      handlers?.onError?.(duplicate);
    });
    render(<ImportReport file={FILE} onChooseAnother={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar as 289 prontas' }));

    const body = createMutate.mock.calls[0]![0];
    expect(body).toMatchObject({ kind: 'csv', name: 'colecao-lucas.csv', fileName: 'colecao-lucas.csv' });
    expect(body.ready).toHaveLength(289);
    expect(body.pending).toHaveLength(11);
    expect(body.pending[0]).toMatchObject({ lineNumber: 23, originalText: 'Snatch,2,', reason: 'asks_color', suggestedCardIdentifier: 'snatch-red' });
    expect(await screen.findByText('Você já adicionou esta planilha como "colecao-lucas.csv".')).toBeInTheDocument();
  });
});

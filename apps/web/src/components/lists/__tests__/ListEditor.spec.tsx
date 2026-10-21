import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICardList, IListLine } from '../../../api/lists';
import { apiError, createFakeApi, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { makeLine, makeList } from './listsTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const navigateMock = vi.hoisted(() => vi.fn());
const searchRef = vi.hoisted(() => ({ results: [] as unknown[] }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: (query: string) => ({
    data: query.length >= 2 ? { results: searchRef.results } : undefined,
    isSuccess: query.length >= 2,
    isFetching: false,
  }),
}));

import { ListEditor } from '../ListEditor';

let api: IFakeApi;
let current: ICardList;

function serve(list: ICardList): void {
  current = list;
  api.handlers.set(`GET /lists/${list.id}`, () => current);
}

function replaceLine(lineId: number, change: Partial<IListLine>): ICardList {
  current = { ...current, lines: current.lines.map((line) => (line.id === lineId ? { ...line, ...change } : line)) };
  return current;
}

function serveLineWrites(): void {
  api.handlers.set('PATCH /lists/7/lines/1', ({ body }) => {
    const patch = body as Record<string, unknown>;
    const { sold, ...rest } = patch;
    return replaceLine(1, { ...(rest as Partial<IListLine>), ...(sold === undefined ? {} : { sold: sold as boolean }) });
  });
  api.handlers.set('GET /lists/7/printings/pummel-red', () => [
    { printing: 'WTR206.R', label: 'WTR206 · Normal', suggestion: null },
    { printing: 'WTR206.R.F', label: 'WTR206 · Rainbow Foil', suggestion: null },
  ]);
}

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
  navigateMock.mockReset();
  searchRef.results = [];
  api.handlers.set('GET /lists/7/share', () => null);
});

const SELL_LINES = [
  makeLine({ id: 1, quantity: 2, condition: 'NM', priceCents: 600, printing: 'WTR206.R', printingLabel: 'WTR206 · Normal' }),
  makeLine({ id: 2, cardIdentifier: 'snatch-red', name: 'Snatch', quantity: 1 }),
  makeLine({ id: 3, cardIdentifier: 'remembrance', name: 'Remembrance', pitch: null, quantity: 1, sold: true, priceCents: 5500 }),
];

describe('ListEditor', () => {
  it('shows a sell list with condition, price, blanks and the sold card marked', async () => {
    serve(makeList({ lines: SELL_LINES, totalPriceCents: 42000 }));
    renderWithProviders(<ListEditor listId="7" />);

    const tiles = await screen.findAllByTestId('list-line');
    expect(tiles).toHaveLength(3);
    expect(within(tiles[0]!).getByText('NM')).toBeInTheDocument();
    expect(within(tiles[0]!).getByText('R$ 6,00')).toBeInTheDocument();
    expect(within(tiles[0]!).getByText('×2')).toBeInTheDocument();
    expect(within(tiles[1]!).getByText('cond.')).toBeInTheDocument();
    expect(within(tiles[1]!).getByText('sem preço')).toBeInTheDocument();
    expect(within(tiles[2]!).getByTestId('sold-stamp')).toHaveTextContent('Vendida');
    expect(screen.getByRole('textbox', { name: /Tudo por/ })).toHaveValue('R$ 420,00');
    expect(within(screen.getByTestId('totals-bar')).getByText('4 cartas')).toBeInTheDocument();
    expect(within(screen.getByTestId('totals-bar')).getByText('1 vendida')).toBeInTheDocument();
  });

  it('hides the sell-only fields on a want list', async () => {
    serve(makeList({ kind: 'want', priceMultiplier: null, lines: [makeLine({ id: 1 })] }));
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const tile = await screen.findByTestId('list-line');
    expect(within(tile).queryByText('sem preço')).toBeNull();
    expect(screen.queryByRole('textbox', { name: /Tudo por/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Editar Pummel/ }));
    const panel = await screen.findByTestId('line-panel');
    expect(within(panel).getByText('Quantidade')).toBeInTheDocument();
    expect(within(panel).queryByText(/Condição/)).toBeNull();
    expect(within(panel).queryByText(/Preço cada/)).toBeNull();
    expect(within(panel).queryByText(/Versão/)).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Marcar como vendida' })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Remover da lista' })).toBeInTheDocument();
  });

  it('edits quantity, condition, price and printing from the panel', async () => {
    serve(makeList({ lines: SELL_LINES }));
    serveLineWrites();
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: /Editar Pummel/ }));
    const panel = await screen.findByTestId('line-panel');

    await user.click(within(panel).getByRole('button', { name: 'Aumentar quantidade' }));
    await waitFor(() => expect(within(panel).getByText('3')).toBeInTheDocument());
    await user.click(within(panel).getByRole('button', { name: 'LP' }));
    const price = within(panel).getByLabelText('Preço cada (opcional)');
    await user.clear(price);
    await user.type(price, '6,5');
    await user.tab();
    await user.selectOptions(within(panel).getByLabelText('Versão (opcional)'), 'WTR206.R.F');

    await waitFor(() => {
      const bodies = api.calls.filter((call) => call.key === 'PATCH /lists/7/lines/1').map((call) => call.body);
      expect(bodies).toEqual([
        { quantity: 3 },
        { condition: 'LP' },
        { priceCents: 650 },
        { printing: 'WTR206.R.F' },
      ]);
    });
    await waitFor(() => expect(within(panel).getByLabelText('Preço cada (opcional)')).toHaveValue('R$ 6,50'));
  });

  it('flags a price that cannot be read and does not send it', async () => {
    serve(makeList({ lines: SELL_LINES }));
    serveLineWrites();
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: /Editar Pummel/ }));
    const panel = await screen.findByTestId('line-panel');
    const price = within(panel).getByLabelText('Preço cada (opcional)');
    await user.clear(price);
    await user.type(price, 'seis');
    await user.tab();

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Use um valor como 6 ou 6,50.');
    expect(api.calls.some((call) => call.key.startsWith('PATCH'))).toBe(false);
  });

  it('marks a card sold and brings it back', async () => {
    serve(makeList({ lines: SELL_LINES }));
    serveLineWrites();
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: /Editar Pummel/ }));
    const panel = await screen.findByTestId('line-panel');
    await user.click(within(panel).getByRole('button', { name: 'Marcar como vendida' }));
    expect(await within(panel).findByRole('button', { name: 'Voltar para à venda' })).toBeInTheDocument();
    expect(api.calls.filter((call) => call.key === 'PATCH /lists/7/lines/1').map((call) => call.body)).toEqual([{ sold: true }]);
    await user.click(within(panel).getByRole('button', { name: 'Voltar para à venda' }));
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Marcar como vendida' })).toBeInTheDocument());
    expect(api.calls.filter((call) => call.key === 'PATCH /lists/7/lines/1').at(-1)?.body).toEqual({ sold: false });
  });

  it('removes a card and closes the panel', async () => {
    serve(makeList({ lines: SELL_LINES }));
    api.handlers.set('GET /lists/7/printings/pummel-red', () => []);
    api.handlers.set('DELETE /lists/7/lines/1', () => {
      current = { ...current, lines: current.lines.filter((line) => line.id !== 1) };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: /Editar Pummel/ }));
    await user.click(within(await screen.findByTestId('line-panel')).getByRole('button', { name: 'Remover da lista' }));

    await waitFor(() => expect(screen.getAllByTestId('list-line')).toHaveLength(2));
    expect(screen.queryByTestId('line-panel')).toBeNull();
  });

  it('adds a card from the catalog search, with the optional sell fields left blank', async () => {
    serve(makeList({ lines: [] }));
    searchRef.results = [
      { cardIdentifier: 'sink-below-yellow', name: 'Sink Below', pitch: 2, classes: [], types: ['Defense Reaction'], ownedQuantity: 0, imageUrl: null, legalFormats: [], legalHeroes: [], bannedFormats: [] },
    ];
    api.handlers.set('POST /lists/7/lines', ({ body }) => {
      current = { ...current, lines: [makeLine({ id: 9, cardIdentifier: 'sink-below-yellow', name: 'Sink Below', pitch: 2, quantity: (body as { quantity: number }).quantity })] };
      return current;
    });
    api.handlers.set('GET /lists/7/printings/sink-below-yellow', () => []);
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: 'Adicionar carta do catálogo' }));
    await user.type(await screen.findByLabelText('Buscar carta'), 'sink');
    await user.click(await screen.findByRole('button', { name: /Escolher Sink Below/ }));
    const picked = await screen.findByTestId('add-card-picked');
    expect(within(picked).getByText('na coleção: 0')).toBeInTheDocument();
    await user.click(within(picked).getByRole('button', { name: 'Aumentar quantidade' }));
    await user.click(within(picked).getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(api.calls.find((call) => call.key === 'POST /lists/7/lines')?.body).toEqual({ cardIdentifier: 'sink-below-yellow', quantity: 2 }));
    expect(await screen.findByText('Adicionada: Sink Below (Amarelo)')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('list-line')).toHaveLength(1));
  });

  it('merges an existing card: the server answers with the summed line and the grid keeps one tile', async () => {
    serve(makeList({ kind: 'want', priceMultiplier: null, lines: [makeLine({ id: 1, quantity: 2 })] }));
    searchRef.results = [
      { cardIdentifier: 'pummel-red', name: 'Pummel', pitch: 1, classes: [], types: ['Attack Reaction'], ownedQuantity: 1, imageUrl: null, legalFormats: [], legalHeroes: [], bannedFormats: [] },
    ];
    api.handlers.set('POST /lists/7/lines', () => {
      current = { ...current, lines: [makeLine({ id: 1, quantity: 3 })] };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: 'Adicionar carta do catálogo' }));
    await user.type(await screen.findByLabelText('Buscar carta'), 'pummel');
    await user.click(await screen.findByRole('button', { name: /Escolher Pummel/ }));
    await user.click(within(await screen.findByTestId('add-card-picked')).getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(screen.getByText('×3')).toBeInTheDocument());
    expect(screen.getAllByTestId('list-line')).toHaveLength(1);
  });

  it('saves the sale total typed in the bar and clears it when emptied', async () => {
    serve(makeList({ lines: SELL_LINES }));
    api.handlers.set('PATCH /lists/7', ({ body }) => {
      current = { ...current, totalPriceCents: (body as { totalPriceCents: number | null }).totalPriceCents };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const total = await screen.findByRole('textbox', { name: /Tudo por/ });
    await user.click(total);
    expect(total).toHaveValue('12,00');
    await user.clear(total);
    await user.type(total, '420');
    await user.tab();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Tudo por/ })).toHaveValue('R$ 420,00'));
    await user.click(screen.getByRole('textbox', { name: /Tudo por/ }));
    await user.clear(screen.getByRole('textbox', { name: /Tudo por/ }));
    await user.tab();
    await waitFor(() => expect(api.calls.filter((call) => call.key === 'PATCH /lists/7').map((call) => call.body)).toEqual([
      { totalPriceCents: 42000 },
      { totalPriceCents: null },
    ]));
  });

  it('suggests the sum of the priced cards for the total, and saves it only when accepted', async () => {
    serve(makeList({ lines: SELL_LINES }));
    api.handlers.set('PATCH /lists/7', ({ body }) => {
      current = { ...current, totalPriceCents: (body as { totalPriceCents: number | null }).totalPriceCents };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const total = await screen.findByRole('textbox', { name: /Tudo por/ });
    expect(total).toHaveValue('');
    expect(total).toHaveAttribute('placeholder', 'R$ 12,00');
    await user.click(total);
    await user.tab();
    expect(api.calls.some((call) => call.key === 'PATCH /lists/7')).toBe(false);
    expect(screen.getByRole('textbox', { name: /Tudo por/ })).toHaveValue('');

    await user.click(screen.getByRole('textbox', { name: /Tudo por/ }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Tudo por/ })).toHaveValue('R$ 12,00'));
    expect(api.calls.filter((call) => call.key === 'PATCH /lists/7').map((call) => call.body)).toEqual([{ totalPriceCents: 1200 }]);
  });

  it('copies the list as text', async () => {
    serve(makeList({ totalPriceCents: 42000, lines: SELL_LINES }));
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: 'Copiar texto' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(
      '2x Pummel (Vermelho) · NM · R$ 6,00 cada\n1x Snatch (Vermelho)\n\nTotal: R$ 420,00',
    );
    expect(await screen.findByText('Copiado')).toBeInTheDocument();
  });

  it('ends the copied text with the address when the list is shared', async () => {
    serve(makeList({ kind: 'want', lines: [makeLine({ id: 1, quantity: 2 })] }));
    api.handlers.set('GET /lists/7/share', () => ({
      intent: 'want',
      url: 'https://rathearsenal.app/l/aB3dE5gH7jK9mN',
      token: 'aB3dE5gH7jK9mN',
      showContact: true,
    }));
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithProviders(<ListEditor listId="7" />);

    const copy = await screen.findByRole('button', { name: 'Copiar texto' });
    await waitFor(() => expect(api.calls.some((call) => call.key === 'GET /lists/7/share')).toBe(true));
    await act(async () => undefined);
    await user.click(copy);

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith('2x Pummel (Vermelho)\n\nhttps://rathearsenal.app/l/aB3dE5gH7jK9mN');
  });

  it('opens the share dialog from the bottom bar', async () => {
    serve(makeList({ kind: 'want', lines: [makeLine({ id: 1 })] }));
    api.handlers.set('POST /lists/7/share', () => ({
      intent: 'want',
      url: 'https://rathearsenal.app/l/aB3dE5gH7jK9mN',
      token: 'aB3dE5gH7jK9mN',
      showContact: true,
    }));
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByTestId('list-share-open'));

    expect(await screen.findByTestId('share-address')).toHaveValue('https://rathearsenal.app/l/aB3dE5gH7jK9mN');
  });

  it('renames the list and deletes it after confirming', async () => {
    serve(makeList({ lines: [] }));
    api.handlers.set('PATCH /lists/7', ({ body }) => {
      current = { ...current, name: (body as { name: string }).name };
      return current;
    });
    api.handlers.set('DELETE /lists/7', () => undefined);
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: /Renomear: Oscilio completo/ }));
    const field = screen.getByRole('textbox', { name: 'Nome da lista' });
    await user.clear(field);
    await user.type(field, 'Sobras{Enter}');
    expect(await screen.findByRole('heading', { name: /Sobras/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excluir lista' }));
    await user.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/lists' }));
  });

  it('says so when the list is not found', async () => {
    api.handlers.set('GET /lists/7', () => {
      throw apiError(404, 'CARD_LIST_NOT_FOUND');
    });
    renderWithProviders(<ListEditor listId="7" />);
    expect(await screen.findByText('Lista não encontrada.')).toBeInTheDocument();
  });
});

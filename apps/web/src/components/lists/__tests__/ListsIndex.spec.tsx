import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ITrackedDeckListItem } from '../../../api/decks';
import { createFakeApi, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { makeList, makeSummary } from './listsTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => (
    <a href={params ? to.replace('$listId', params['listId'] ?? '') : to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

const DECKS = vi.hoisted(() => ({
  trackedDecks: [
    { id: 11, name: 'Oscilio Azul Tempo', cardCounts: { owned: 45, missing: 15, total: 60 } },
    { id: 12, name: 'Rhinar Rampage', cardCounts: { owned: 60, missing: 0, total: 60 } },
  ] as unknown as ITrackedDeckListItem[],
}));

vi.mock('../../../api/decks', () => ({ useDecksQuery: () => ({ data: DECKS }) }));

import { ListsIndex } from '../ListsIndex';

let api: IFakeApi;

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
  navigateMock.mockReset();
});

function serve(lists: ReturnType<typeof makeSummary>[]): void {
  api.handlers.set('GET /lists', () => lists);
}

describe('ListsIndex', () => {
  it('marks only the lists with a live link as shared', async () => {
    serve([
      makeSummary({ id: 1, kind: 'want', name: 'Faltam pro Oscilio', shared: true }),
      makeSummary({ id: 2, kind: 'sell', name: 'Oscilio completo', shared: false }),
    ]);
    renderWithProviders(<ListsIndex />);

    const badges = await screen.findAllByTestId('list-shared-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('Compartilhada');
    expect(within(await screen.findByTestId('lists-want')).getByTestId('list-shared-badge')).toBeInTheDocument();
    expect(within(screen.getByTestId('lists-sell')).queryByTestId('list-shared-badge')).not.toBeInTheDocument();
  });

  it('groups lists into Procuro and Vendo with counts and the sale total', async () => {
    serve([
      makeSummary({ id: 1, kind: 'want', name: 'Faltam pro Oscilio', copyCount: 15 }),
      makeSummary({ id: 2, kind: 'sell', name: 'Oscilio completo', copyCount: 17, soldCount: 1, totalPriceCents: 42000 }),
    ]);
    renderWithProviders(<ListsIndex />);

    const want = await screen.findByTestId('lists-want');
    const sell = screen.getByTestId('lists-sell');
    expect(within(want).getByText('Faltam pro Oscilio')).toBeInTheDocument();
    expect(within(want).getByText(/15 cartas/)).toBeInTheDocument();
    expect(within(want).queryByText('Oscilio completo')).toBeNull();
    expect(within(sell).getByText('Oscilio completo')).toBeInTheDocument();
    expect(within(sell).getByText(/17 cartas · 1 vendida/)).toBeInTheDocument();
    expect(within(sell).getByText('Tudo por R$ 420,00')).toBeInTheDocument();
    expect(within(want).getByRole('link')).toHaveAttribute('href', '/lists/1');
  });

  it('shows the empty state with a door for each kind', async () => {
    serve([]);
    renderWithProviders(<ListsIndex />);
    expect(await screen.findByText(/Você ainda não tem listas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar lista de procuro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar lista de venda' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nova/ })).toBeNull();
  });

  it('creates a want list from a deck, named after the deck', async () => {
    serve([makeSummary()]);
    api.handlers.set('POST /lists', ({ body }) => makeList({ id: 55, kind: 'want', name: (body as { name: string }).name }));
    const user = userEvent.setup();
    renderWithProviders(<ListsIndex />);

    await user.click(await screen.findByRole('button', { name: /Nova lista/ }));
    const dialog = await screen.findByTestId('new-list-dialog');
    await user.click(within(dialog).getByRole('radio', { name: /De um deck/ }));
    expect(within(dialog).getByRole('option', { name: 'Oscilio Azul Tempo (faltam 15 de 60)' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nome da lista')).toHaveValue('Faltam pro Oscilio Azul Tempo');
    await user.click(within(dialog).getByRole('button', { name: 'Criar lista' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/lists/$listId', params: { listId: '55' } }));
    const post = api.calls.find((call) => call.key === 'POST /lists');
    expect(post?.body).toEqual({ kind: 'want', name: 'Faltam pro Oscilio Azul Tempo', fromDeckId: 11 });
  });

  it('creates a sell list from a deck, named like the deck, with the chosen deck', async () => {
    serve([]);
    api.handlers.set('POST /lists', () => makeList({ id: 56 }));
    const user = userEvent.setup();
    renderWithProviders(<ListsIndex />);

    await user.click(await screen.findByRole('button', { name: 'Criar lista de venda' }));
    const dialog = await screen.findByTestId('new-list-dialog');
    expect(within(dialog).getByRole('radio', { name: /Vendo/ })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: /De um deck/ }));
    await user.selectOptions(within(dialog).getByLabelText('Deck'), '12');
    expect(within(dialog).getByLabelText('Nome da lista')).toHaveValue('Rhinar Rampage');
    await user.click(within(dialog).getByRole('button', { name: 'Criar lista' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(api.calls.find((call) => call.key === 'POST /lists')?.body).toEqual({
      kind: 'sell',
      name: 'Rhinar Rampage',
      fromDeckId: 12,
    });
  });

  it('a new sell list starts from spare copies first', async () => {
    serve([]);
    const user = userEvent.setup();
    renderWithProviders(<ListsIndex />);

    await user.click(await screen.findByRole('button', { name: 'Criar lista de venda' }));
    const dialog = await screen.findByTestId('new-list-dialog');
    const starts = within(dialog).getByTestId('new-list-starts');

    const titles = Array.from(starts.children).map((child) => child.querySelector('span[class*="radioTitle"]')?.textContent);
    expect(titles).toEqual(['Vender o que sobra na sua coleção', 'De um deck', 'Do zero']);
    expect(within(starts).getByText('Para cartas que não estão no app')).toBeInTheDocument();

    await user.click(within(starts).getByRole('button', { name: /Vender o que sobra na sua coleção/ }));

    expect(navigateMock).toHaveBeenCalledWith({ to: '/spare' });
    expect(api.calls.some((call) => call.key === 'POST /lists')).toBe(false);
  });

  it('a new want list has no spare start', async () => {
    serve([]);
    const user = userEvent.setup();
    renderWithProviders(<ListsIndex />);

    await user.click(await screen.findByRole('button', { name: 'Criar lista de procuro' }));
    const starts = within(await screen.findByTestId('new-list-dialog')).getByTestId('new-list-starts');

    expect(within(starts).queryByRole('button', { name: /Vender o que sobra/ })).not.toBeInTheDocument();
    expect(within(starts).getAllByRole('radio')).toHaveLength(2);
  });

  it('creates an empty list from nothing and needs a name first', async () => {
    serve([]);
    api.handlers.set('POST /lists', () => makeList({ id: 57, kind: 'want' }));
    const user = userEvent.setup();
    renderWithProviders(<ListsIndex />);

    await user.click(await screen.findByRole('button', { name: 'Criar lista de procuro' }));
    const dialog = await screen.findByTestId('new-list-dialog');
    const submit = within(dialog).getByRole('button', { name: 'Criar lista' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await user.type(within(dialog).getByLabelText('Nome da lista'), 'Procuro avulsas');
    await user.click(submit);

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
    expect(api.calls.find((call) => call.key === 'POST /lists')?.body).toEqual({ kind: 'want', name: 'Procuro avulsas' });
  });
});

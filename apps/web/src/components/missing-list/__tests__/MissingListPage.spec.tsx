import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MissingListPage } from '../MissingListPage';
import { line, Providers, response } from './missingListKit';
import type { IMissingListResponse } from '../../../api/missing-list';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const toast = vi.hoisted(() => ({ show: vi.fn() }));
const phone = vi.hoisted(() => ({ value: false }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: toast.show }) }));
vi.mock('../../../hooks/useMediaQuery', () => ({ useMediaQuery: () => phone.value }));
vi.mock('../../deck-detail/ShareDialog', () => ({
  ShareDialog: ({ open, initialIntent }: { open: boolean; initialIntent: string | null }) =>
    open ? <div data-testid="share-dialog" data-intent={initialIntent} /> : null,
}));

function serve(data: IMissingListResponse): void {
  api.fetch.mockImplementation(async (path: string) => {
    if (path === '/decks/7/missing') return data;
    if (path === '/decks/7') return { id: 7, name: '[CC] Brute do Caio', hero: 'Rhinar' };
    if (path.startsWith('/decks/7/alternatives?')) {
      const cardIdentifier = new URLSearchParams(path.split('?')[1]).get('cardIdentifier');
      const needed = data.lines.find((candidate) => candidate.cardIdentifier === cardIdentifier)?.deckNeeded ?? 0;
      return {
        needed,
        groups: [
          {
            group: 'other_pitch',
            cards: [
              { cardIdentifier: 'candidate-red', name: 'Candidate', pitch: 1, imageUrl: null, freeCopies: needed, priceCents: null, productUrl: null, rationale: null },
              { cardIdentifier: 'candidate-blue', name: 'Candidate', pitch: 3, imageUrl: null, freeCopies: 0, priceCents: null, productUrl: null, rationale: null },
            ],
          },
        ],
      };
    }
    throw new Error(`unhandled ${path}`);
  });
}

async function renderPage(data: IMissingListResponse): Promise<HTMLElement> {
  serve(data);
  render(
    <Providers>
      <MissingListPage deckId={7} />
    </Providers>,
  );
  return screen.findByTestId('missing-list-page');
}

beforeEach(() => {
  api.fetch.mockReset();
  toast.show.mockReset();
  phone.value = false;
});

describe('MissingListPage', () => {
  it('the summary counts copies and states the price window once', async () => {
    const page = await renderPage(response([line()]));

    expect(page).toHaveTextContent('Falta comprar: 43 cópias · R$ 452,28 na Cúpula DT');
    expect(page).toHaveTextContent('Já descontei 5 cópias que você tem e 2 que você troca por cartas suas.');
    expect(screen.getAllByText(/Preços conferidos nos últimos 30 dias/)).toHaveLength(1);
    expect(screen.getByText(/Preços conferidos/)).toHaveTextContent(
      'Preços conferidos nos últimos 30 dias. Estoque conferido em 19/10. O preço final aparece no site da loja.',
    );
    for (const row of screen.getAllByTestId('missing-row')) expect(row).not.toHaveTextContent(/\d{2}\/\d{2}/);
  });

  it('the chips carry copy counts and the price chips appear only when needed', async () => {
    await renderPage(response([line()]));

    for (const name of ['Comprar na loja 43', 'A loja não tem 14', 'Fora do site 2', 'Já tenho 5', 'No lugar 2']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^Sem preço/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Buscando/ })).toBeNull();
    document.body.innerHTML = '';

    await renderPage(
      response(
        [
          line({ cardIdentifier: 'a', state: 'no_price', deckNeeded: 2, unitPriceCents: null, lineCents: null, availableCopies: null }),
          line({ cardIdentifier: 'b', state: 'looking_up', deckNeeded: 1, unitPriceCents: null, lineCents: null, availableCopies: null }),
        ],
        { lookingUp: 1, noPrice: 1 },
      ),
    );
    expect(await screen.findByRole('button', { name: 'Sem preço 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscando 1' })).toBeInTheDocument();
    expect(screen.getByText('1 cartas ainda buscando preço')).toBeInTheDocument();
  });

  it('copying the shopping list toasts Lista copiada', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await renderPage(response([line()]));
    await waitFor(() => expect(api.fetch.mock.calls.some(([path]) => path === '/decks/7')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Copiar lista de compras' }));

    await waitFor(() => expect(toast.show).toHaveBeenCalledWith({ kind: 'success', message: 'Lista copiada' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).toContain('3x Pack Hunt (Vermelho) · R$ 0,20 cada');
  });

  it('opens the share sheet on the missing-cards link', async () => {
    await renderPage(response([line()]));

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar a lista' }));

    expect(screen.getByTestId('share-dialog')).toHaveAttribute('data-intent', 'missing');
  });

  it('inventory copies are named apart', async () => {
    const lines = [
      line({ cardIdentifier: 'a', name: 'Alpha', deckNeeded: 4, inventoryNeeded: 0, deckQuantity: 4, availableCopies: 4, lineCents: 400 }),
      line({ cardIdentifier: 'b', name: 'Bravo', deckNeeded: 0, inventoryNeeded: 2, deckQuantity: 2, availableCopies: 2, lineCents: 200 }),
      line({ cardIdentifier: 'c', name: 'Charlie', deckNeeded: 0, inventoryNeeded: 1, deckQuantity: 1, availableCopies: 1, lineCents: 100 }),
    ];
    const page = await renderPage(response(lines, { buyCopies: 7, buyCents: 700 }));

    expect(page).toHaveTextContent('Faltam 7 cópias de 3 cartas · 4 do deck, 3 do inventário');
    expect(screen.getByTestId('shopping-split')).toHaveTextContent('4 do deck, 3 do inventário');

    // The copied shopping list counts the inventory copies too: the two inventory-only cards are rows of it.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await waitFor(() => expect(api.fetch.mock.calls.some(([path]) => path === '/decks/7')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar lista de compras' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect((writeText.mock.calls[0]![0] as string).split('\n').slice(1)).toEqual([
      '4x Alpha (Vermelho) · R$ 0,20 cada',
      '2x Bravo (Vermelho) · R$ 0,20 cada',
      '1x Charlie (Vermelho) · R$ 0,20 cada',
      'Total: 7 cópias · R$ 7,00',
    ]);
  });

  it('shows the phone arrangement with the bottom bar and the rest of the cards behind a button', async () => {
    phone.value = true;
    const many = Array.from({ length: 8 }, (_, index) => line({ cardIdentifier: `card-${index}`, name: `Card ${index}`, pitch: null }));
    const page = await renderPage(response(many));

    expect(page).toHaveAttribute('data-layout', 'phone');
    expect(screen.getAllByTestId('missing-row')).toHaveLength(6);
    const bar = screen.getByRole('group', { name: 'Ações da lista' });
    expect(within(bar).getAllByRole('button').map((button) => button.textContent)).toEqual(['Compartilhar a lista', 'Copiar lista de compras']);

    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais 2 cartas/ }));

    expect(screen.getAllByTestId('missing-row')).toHaveLength(8);
  });

  it('shows the desktop table with the footer and the two lower sections', async () => {
    const lines = [
      line({ cardIdentifier: 'a', name: 'Alpha' }),
      line({ cardIdentifier: 'b', name: 'Reckless Swing', pitch: 3, state: 'store_lacks', deckNeeded: 3, unitPriceCents: null, lineCents: null, availableCopies: null }),
      line({ cardIdentifier: 'c', name: 'Crater Fist', pitch: null, state: 'not_on_site', deckNeeded: 1, unitPriceCents: null, lineCents: null, availableCopies: null, productUrl: null, searchUrl: 'https://store.test/?view=ecom/itens&busca=Crater%20Fist' }),
    ];
    const page = await renderPage(response(lines, { buyCopies: 3, buyCents: 60, lacksCopies: 3, notOnSiteCopies: 1 }));

    expect(within(page).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Carta', 'Faltam', 'Já tenho', 'No lugar', 'Preço cada', 'Total', 'Link',
    ]);
    expect(screen.getByTestId('missing-footer')).toHaveTextContent('1 cartas na loja · 3 cópias a comprar · R$ 0,60');
    expect(screen.getByRole('heading', { name: 'A loja não tem agora · 3 cópias' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fora do site · 1 cópias' })).toBeInTheDocument();
  });

  it('keeps a card fully covered by a stand-in in the list, with Desfazer', async () => {
    const covered = line({
      cardIdentifier: 'alpha-rampage-red',
      name: 'Alpha Rampage',
      deckNeeded: 0,
      availableCopies: 0,
      lineCents: 0,
      standIn: { cardIdentifier: 'awakening-bellow-red', name: 'Awakening Bellow', pitch: 1, copies: 3, savingCents: 45000, used: true, replacementId: 'r1' },
    });
    await renderPage(response([covered, line({ cardIdentifier: 'b', name: 'Bravo' })]));

    const row = screen.getAllByTestId('missing-row').find((item) => item.textContent?.includes('Alpha Rampage'))!;
    expect(row).toHaveTextContent('Você vai usar 3 Awakening Bellow (Vermelho), que já tem, no lugar de 3 · economiza R$ 450,00');
    expect(within(row).getByRole('button', { name: /^Desfazer a troca de Alpha Rampage/ })).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: /^Comprar/ })).toBeNull();
    expect(row).not.toHaveTextContent('faltam');
  });

  it('says so when nothing is missing', async () => {
    const page = await renderPage(response([], { buyCopies: 0, buyCents: 0, lacksCopies: 0, notOnSiteCopies: 0, ownedCopies: 66, standInCopies: 0 }));

    expect(page).toHaveTextContent('Nada falta neste deck.');
  });

  it("the Alternativas link opens the sheet for that row's card and count", async () => {
    phone.value = true;
    const rows = [
      line({ cardIdentifier: 'bloodrush-bellow-yellow', name: 'Bloodrush Bellow', pitch: 2, deckNeeded: 3 }),
      line({ cardIdentifier: 'savage-swing-red', name: 'Savage Swing', pitch: 1, deckNeeded: 1 }),
      line({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, deckNeeded: 3 }),
    ];
    await renderPage(response(rows));
    const expected = [
      { name: 'Bloodrush Bellow (Amarelo)', needed: 'Ocupa o lugar de 3 cópias que faltam.' },
      { name: 'Savage Swing (Vermelho)', needed: 'Ocupa o lugar de 1 cópia que falta.' },
      { name: 'Pack Hunt (Vermelho)', needed: 'Ocupa o lugar de 3 cópias que faltam.' },
    ];

    for (const { name, needed } of expected) {
      fireEvent.click(screen.getByRole('button', { name: `Ver alternativas para ${name}` }));

      const sheet = await screen.findByTestId('alternatives-sheet');
      expect(within(sheet).getByRole('heading', { name: `Alternativas para ${name}` })).toBeInTheDocument();
      expect(await within(sheet).findByText(needed)).toBeInTheDocument();
      expect(within(sheet).getByLabelText('Buscar pelo nome')).toHaveAttribute('placeholder', 'Nome da carta');
      expect(within(sheet).getAllByTestId('alternative-ownership').map((tag) => tag.textContent)).toEqual(['você tem', 'nenhuma livre']);

      const picks = api.fetch.mock.calls.filter(([path, init]) => String(path).includes('/replacements') && init !== undefined);
      fireEvent.click(within(sheet).getByRole('button', { name: 'Fechar' }));
      await waitFor(() => expect(screen.queryByTestId('alternatives-sheet')).toBeNull());
      expect(api.fetch.mock.calls.filter(([path, init]) => String(path).includes('/replacements') && init !== undefined)).toHaveLength(picks.length);
      expect(picks).toHaveLength(0);
    }
  });
});

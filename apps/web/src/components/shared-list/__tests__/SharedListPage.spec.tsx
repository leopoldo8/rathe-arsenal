import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISharedListLine, ISharedListResponse } from '../../../api/shared-lists';
import { SHARE_RETURN_STORAGE_KEY } from '../../../lib/share-return';
import {
  apiError,
  createFakeApi,
  makeAuth,
  renderWithProviders,
  type IFakeApi,
} from '../../shared-deck/__tests__/sharingTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
    onClick?: () => void;
  }) => (
    <a
      href={params === undefined ? to : to.replace('$listId', params['listId'] ?? '')}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { SharedListPage } from '../SharedListPage';
import { DUDA, DUDA_MATCHES, MARCOS } from './visitorKit';

const TOKEN = 'aB3dE5gH7jK9mN';
const URL = `https://rathearsenal.app/l/${TOKEN}`;

function line(overrides: Partial<ISharedListLine>): ISharedListLine {
  return {
    id: 1,
    cardIdentifier: 'pummel-red',
    name: 'Pummel',
    pitch: 1,
    type: 'Attack Reaction',
    imageUrl: null,
    quantity: 2,
    printingLabel: null,
    condition: null,
    priceCents: null,
    sold: false,
    ...overrides,
  };
}

const BASE: ISharedListResponse = {
  kind: 'want',
  token: TOKEN,
  url: URL,
  name: 'Faltam pro Oscilio',
  notes: 'Troco por outras cartas do Oscilio.',
  sharerName: 'Rafa Teixeira',
  contactWhatsapp: null,
  isOwner: false,
  listId: null,
  totalPriceCents: null,
  updatedAt: '2026-10-19T12:00:00.000Z',
  lines: [
    line({ id: 1, quantity: 3 }),
    line({ id: 2, cardIdentifier: 'snatch-red', name: 'Snatch', quantity: 2 }),
    line({ id: 3, cardIdentifier: 'sink-below-blue', name: 'Sink Below', pitch: 3, quantity: 1 }),
  ],
};

const SELL: ISharedListResponse = {
  ...BASE,
  kind: 'sell',
  name: 'Oscilio completo',
  notes: null,
  totalPriceCents: 42000,
  lines: [
    line({ id: 1, quantity: 2, printingLabel: 'Foil arco-íris', condition: 'NM', priceCents: 3800 }),
    line({ id: 2, cardIdentifier: 'snatch-red', name: 'Snatch', quantity: 3 }),
    line({ id: 3, cardIdentifier: 'remembrance', name: 'Remembrance', pitch: null, quantity: 1, condition: 'MP', sold: true }),
    line({ id: 4, cardIdentifier: 'tome', name: 'Tome of Fyendal', pitch: null, quantity: 2, priceCents: 900 }),
  ],
};

function renderPage(auth = makeAuth({ user: null })) {
  renderWithProviders(<SharedListPage token={TOKEN} />, auth);
}

describe('SharedListPage', () => {
  let api: IFakeApi;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => BASE);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('anonymous visitor on a want list', () => {
    it('shows the kind, name, sharer, notes, quantities, the disclaimer once, and no sell details', async () => {
      renderPage();

      expect(await screen.findByRole('heading', { level: 1, name: 'Faltam pro Oscilio' })).toBeInTheDocument();
      expect(screen.getByTestId('shared-list-kind')).toHaveTextContent('Procuro');
      expect(screen.getByText('Rafa Teixeira')).toBeInTheDocument();
      expect(screen.getByText(/procura estas cartas/)).toBeInTheDocument();
      expect(screen.getByTestId('shared-list-notes')).toHaveTextContent('Troco por outras cartas do Oscilio.');
      const cards = screen.getAllByTestId('shared-card');
      expect(cards).toHaveLength(3);
      expect(cards[0]).toHaveTextContent('3×');
      expect(screen.queryByTestId('shared-line-details')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-list-total')).not.toBeInTheDocument();
      const footer = screen.getByTestId('shared-deck-footer');
      expect(footer.textContent?.match(/© Legend Story Studios/g)).toHaveLength(1);
    });

    it('the list tiles name the pitch', async () => {
      renderPage();

      const tiles = await screen.findAllByTestId('shared-card');

      expect(within(tiles[0]!).getByRole('img', { name: 'Pummel (Vermelho)' })).toBeInTheDocument();
      expect(within(tiles[2]!).getByRole('img', { name: 'Sink Below (Azul)' })).toBeInTheDocument();
      expect(within(tiles[2]!).getAllByText('Sink Below (Azul)').length).toBeGreaterThan(0);
    });

    it('loads with one request and asks for no matches', async () => {
      renderPage();
      await screen.findByRole('heading', { level: 1 });
      expect(api.calls).toEqual([{ key: `GET /shared/lists/${TOKEN}`, body: undefined }]);
    });

    it('is invited to sign up, and the page is remembered for the way back', async () => {
      renderPage();

      const invite = await screen.findByTestId('shared-invite');
      expect(within(invite).getByText('Veja o que você já tem desta lista')).toBeInTheDocument();
      expect(within(invite).getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/sign-in');
      await userEvent.click(within(invite).getByRole('link', { name: 'Criar conta' }));

      expect(JSON.parse(localStorage.getItem(SHARE_RETURN_STORAGE_KEY) ?? 'null')).toEqual({
        returnTo: `/l/${TOKEN}`,
        shareToken: TOKEN,
        savedAt: expect.any(Number),
      });
    });

    it('remembers the list page from the top bar too', async () => {
      renderPage();
      await screen.findByRole('heading', { level: 1 });

      await userEvent.click(screen.getByRole('link', { name: 'Entrar' }));

      expect(localStorage.getItem(SHARE_RETURN_STORAGE_KEY)).toContain(`/l/${TOKEN}`);
    });

    it('copies the list as text with the address', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      renderPage();

      await user.click(await screen.findByTestId('shared-copy-list'));

      expect(writeText).toHaveBeenCalledWith(
        `3x Pummel (Vermelho)\n2x Snatch (Vermelho)\n1x Sink Below (Azul)\n\n${URL}`,
      );
      expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    });
  });

  describe('sell list', () => {
    beforeEach(() => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => SELL);
    });

    it('shows printing, condition and price only where filled, the set price and the sold card marked', async () => {
      renderPage();

      await screen.findByRole('heading', { level: 1, name: 'Oscilio completo' });
      expect(screen.getByTestId('shared-list-kind')).toHaveTextContent('Vendo');
      expect(screen.getByTestId('shared-list-total')).toHaveTextContent('Tudo por R$ 420,00');
      const cards = screen.getAllByTestId('shared-card');
      expect(cards).toHaveLength(4);
      const first = within(cards[0]!).getByTestId('shared-line-details');
      expect(first).toHaveTextContent('Foil arco-íris');
      expect(first).toHaveTextContent('NM');
      expect(first).toHaveTextContent('R$ 38,00 cada');
      expect(within(cards[1]!).queryByTestId('shared-line-details')).not.toBeInTheDocument();
      expect(within(cards[2]!).getByTestId('shared-line-sold')).toHaveTextContent('Vendida');
      expect(cards[2]).toHaveAttribute('data-dimmed', 'true');
      expect(within(cards[3]!).getByTestId('shared-line-details')).toHaveTextContent('R$ 9,00 cada');
      expect(within(cards[0]!).queryByTestId('shared-line-sold')).not.toBeInTheDocument();
    });

    it('a public sell list has no LigaFAB link', async () => {
      renderPage();

      await screen.findByRole('heading', { level: 1, name: 'Oscilio completo' });
      expect(screen.queryByText(/LigaFAB/)).not.toBeInTheDocument();
      expect(document.querySelector('a[href*="ligafab"]')).toBeNull();
    });

    it('copies the list as text without the sold card, with the total and the address', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      renderPage();

      await user.click(await screen.findByTestId('shared-copy-list'));

      expect(writeText).toHaveBeenCalledWith(
        `2x Pummel (Vermelho) · NM · R$ 38,00 cada\n3x Snatch (Vermelho)\n2x Tome of Fyendal · R$ 9,00 cada\n\nTotal: R$ 420,00\n\n${URL}`,
      );
    });

    it('invites the visitor to see what their decks are missing', async () => {
      renderPage();
      expect(await screen.findByText('Veja o que desta lista faz falta nos seus decks')).toBeInTheDocument();
    });
  });

  describe('logged-in visitor', () => {
    it('marks the cards they own on a want list, with the count, and sums them up', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => ({
        lines: [
          { lineId: 1, owned: 1, missingInDecks: 0 },
          { lineId: 2, owned: 2, missingInDecks: 0 },
          { lineId: 3, owned: 0, missingInDecks: 0 },
        ],
      }));
      renderPage(makeAuth());

      const owned = await screen.findAllByTestId('shared-line-owned');
      expect(owned.map((node) => node.textContent)).toEqual(['Você tem 1', 'Você tem 2']);
      expect(await screen.findByTestId('shared-list-summary')).toHaveTextContent('Você tem 2 de 3 cartas desta lista.');
      expect(screen.queryByTestId('shared-invite')).not.toBeInTheDocument();
      expect(api.calls.some((call) => call.key === `GET /shared/lists/${TOKEN}/matches`)).toBe(true);
    });

    it('marks the cards missing in their decks on a sell list, leaving sold cards unmarked', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => SELL);
      api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => ({
        lines: [
          { lineId: 1, owned: 0, missingInDecks: 2 },
          { lineId: 2, owned: 1, missingInDecks: 0 },
          { lineId: 3, owned: 0, missingInDecks: 0 },
          { lineId: 4, owned: 0, missingInDecks: 1 },
        ],
      }));
      renderPage(makeAuth());

      const missing = await screen.findAllByTestId('shared-line-missing');
      expect(missing.map((node) => node.textContent)).toEqual(['Faltam 2 nos seus decks', 'Falta 1 nos seus decks']);
      expect(await screen.findByTestId('shared-list-summary')).toHaveTextContent('2 cartas desta lista fazem falta nos seus decks.');
      const sold = screen.getAllByTestId('shared-card')[2]!;
      expect(within(sold).queryByTestId('shared-line-missing')).not.toBeInTheDocument();
    });

    it('says so when nothing on a sell list is missing in their decks', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => SELL);
      api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => ({
        lines: SELL.lines.map((item) => ({ lineId: item.id, owned: 0, missingInDecks: 0 })),
      }));
      renderPage(makeAuth());

      expect(await screen.findByTestId('shared-list-summary')).toHaveTextContent('Nenhuma carta desta lista falta nos seus decks.');
    });

    it('keeps the page whole when the matches cannot be loaded', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => {
        throw apiError(500, null);
      });
      renderPage(makeAuth());

      expect(await screen.findAllByTestId('shared-card')).toHaveLength(3);
      expect(screen.queryByTestId('shared-line-owned')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-list-summary')).not.toBeInTheDocument();
    });
  });

  describe('owner', () => {
    beforeEach(() => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...BASE, isOwner: true, listId: 7 }));
    });

    it('gets a link to the editor, no matches and no invitation', async () => {
      renderPage(makeAuth());

      expect(await screen.findByRole('link', { name: 'Gerenciar lista' })).toHaveAttribute('href', '/lists/7');
      expect(api.calls.some((call) => call.key.includes('/matches'))).toBe(false);
      expect(screen.queryByTestId('shared-invite')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-list-summary')).not.toBeInTheDocument();
    });
  });

  describe('WhatsApp contact', () => {
    const WA_URL = 'https://wa.me/5553999990000?text=Oi!%20Vi%20sua%20lista%20Faltam%20pro%20Oscilio%20no%20Rathe%20Arsenal.';

    it('shows the pill and the bottom bar opening the chat, and the invitation stays inline', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...BASE, contactWhatsapp: '5553999990000' }));
      renderPage();

      expect(await screen.findByTestId('shared-contact-pill')).toHaveAttribute('href', WA_URL);
      const bar = screen.getByTestId('shared-contact-bar');
      expect(within(bar).getByRole('link', { name: 'Chamar Rafa Teixeira no WhatsApp' })).toHaveAttribute('href', WA_URL);
      expect(screen.getByTestId('shared-invite').className).not.toContain('invitePinned');
    });

    it('pins the invitation to the bottom on phones when there is no contact', async () => {
      renderPage();
      expect((await screen.findByTestId('shared-invite')).className).toContain('invitePinned');
      expect(screen.queryByTestId('shared-contact-bar')).not.toBeInTheDocument();
    });
  });

  describe('unavailable link', () => {
    it('shows the same page as a dead deck link, with no list data and no contact', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => {
        throw apiError(404, 'SHARE_LINK_UNAVAILABLE');
      });
      renderPage();

      expect(await screen.findByTestId('shared-unavailable')).toHaveTextContent('Este link não está mais disponível.');
      expect(screen.queryByTestId('shared-contact-bar')).not.toBeInTheDocument();
      expect(screen.getByTestId('shared-deck-footer')).toBeInTheDocument();
    });
  });

  it('shows a loading state, then a retry when the list cannot be loaded', async () => {
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => {
      throw apiError(500, null);
    });
    renderPage();

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent('Não foi possível carregar esta página.');
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('says the list is empty and disables copying when it has no cards', async () => {
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...BASE, lines: [] }));
    renderPage();

    expect(await screen.findByText('Esta lista está vazia.')).toBeInTheDocument();
    expect(screen.getByTestId('shared-copy-list')).toBeDisabled();
  });

  describe('signed-in visitor on a sell list (buyer view)', () => {
    beforeEach(() => {
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => DUDA);
      api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => DUDA_MATCHES);
    });

    it('a buyer sees version, price, deck hint and a stepper at 0', async () => {
      renderPage(makeAuth());

      const view = await screen.findByTestId('shared-list-buyer');
      const order = Array.from(view.querySelectorAll('p[class*="eyebrow"], h1, p[class*="summary"], li')).map((node) => node.textContent);
      expect(order[0]).toBe('Lista de venda');
      expect(screen.getByRole('heading', { level: 1, name: 'Duda vende estas cartas' })).toBeInTheDocument();
      expect(await screen.findByText('3 cartas desta lista servem nos seus decks')).toBeInTheDocument();
      const rows = screen.getAllByTestId('buyer-row');
      expect(rows).toHaveLength(3);
      expect(within(rows[0]!).getByText('Command and Conquer (Vermelho)')).toBeInTheDocument();
      expect(within(rows[0]!).getByText('History Pack 1 · NM · R$ 45')).toBeInTheDocument();
      expect(within(rows[0]!).getByText('Falta 1 no seu Rhinar CC')).toBeInTheDocument();
      expect(within(rows[1]!).getByText('sem foil · R$ 6 cada')).toBeInTheDocument();
      expect(within(rows[1]!).getByText('Faltam 2 no seu Kayo CC')).toBeInTheDocument();
      for (const row of rows) expect(row.querySelector('output')).toHaveTextContent('0');
      expect(screen.queryByTestId('buyer-bar')).not.toBeInTheDocument();
    });

    it('names the deck that misses the card most, with that deck own count', async () => {
      api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => ({
        lines: [
          {
            lineId: 2,
            owned: 0,
            missingInDecks: 3,
            decks: [
              { deckId: 1, deckName: 'Rhinar CC', missing: 1 },
              { deckId: 2, deckName: 'Kayo CC', missing: 2 },
            ],
          },
        ],
      }));
      renderPage(makeAuth());

      expect(await screen.findByText('Faltam 2 no seu Kayo CC')).toBeInTheDocument();
      expect(screen.queryByText(/Rhinar CC/)).not.toBeInTheDocument();
    });

    it.each(['sell', 'want'] as const)('the owner gets no selection and no offer on a %s list', async (kind) => {
      const own = kind === 'sell' ? DUDA : MARCOS;
      api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...own, isOwner: true, listId: 7, lines: own.lines.map((line) => ({ ...line, owned: null, spare: null })) }));
      renderPage(makeAuth());

      expect(await screen.findByRole('link', { name: 'Gerenciar lista' })).toBeInTheDocument();
      expect(screen.queryByTestId('shared-list-buyer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-list-trade')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Quero estas/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ver mensagem' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Oferecer/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mais uma cópia/ })).not.toBeInTheDocument();
    });
  });
});

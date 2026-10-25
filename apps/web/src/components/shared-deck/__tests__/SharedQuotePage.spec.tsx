import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISharedQuoteItem, ISharedQuoteResponse } from '../../../api/shared-decks';
import { createFakeApi, makeAuth, renderWithProviders, type IFakeApi } from './sharingTestKit';
import { writeQuoteDraft } from '../quoteDraft';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: showToast }) }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { SharedQuotePage } from '../SharedQuotePage';

const TOKEN = 'qT3rZ9nUp2bX5yKdFgHjLs';

function item(cardIdentifier: string, name: string, pitch: 1 | 2 | 3 | null, quantity: number): ISharedQuoteItem {
  return { cardIdentifier, name, pitch, imageUrl: null, quantity };
}

// 27 cards and 59 copies, as the quote screen draws them.
const NEEDED: readonly ISharedQuoteItem[] = [
  item('alpha-rampage-red', 'Alpha Rampage', 1, 1),
  item('bloodrush-bellow-yellow', 'Bloodrush Bellow', 2, 3),
  item('reckless-swing-blue', 'Reckless Swing', 3, 3),
  item('pack-hunt-red', 'Pack Hunt', 1, 3),
  ...Array.from({ length: 23 }, (_, index) => item(`filler-${index}`, `Filler ${String(index + 1).padStart(2, '0')}`, null, index === 22 ? 5 : 2)),
];

const QUOTE: ISharedQuoteResponse = {
  intent: 'quote',
  name: '[CC] Brute do Caio',
  hero: 'Rhinar, Reckless Rampage',
  sharerName: 'Caio',
  contactWhatsapp: '5551999990000',
  needed: NEEDED,
};

function renderQuote(quote: ISharedQuoteResponse = QUOTE) {
  return renderWithProviders(<SharedQuotePage token={TOKEN} quote={quote} />, makeAuth({ user: null }));
}

describe('SharedQuotePage', () => {
  let api: IFakeApi;
  let open: MockInstance<typeof window.open>;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set(`POST /shared/decks/${TOKEN}/events`, () => undefined);
    open = vi.spyOn(window, 'open').mockReturnValue(null);
    showToast.mockReset();
    userEvent.setup();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lists every needed card with a stepper, a price and a note', () => {
    renderQuote();

    expect(screen.getByText('Pedido de orçamento')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Caio pediu um orçamento para estas cartas.' })).toBeInTheDocument();
    expect(screen.getByText('Marque o que você tem e o preço; a resposta vai pelo WhatsApp.')).toBeInTheDocument();
    expect(screen.getByText('Caio ainda precisa de 59 cópias (27 cartas).')).toBeInTheDocument();

    const rows = screen.getAllByTestId('quote-row');
    expect(rows).toHaveLength(27);
    expect(screen.queryByText(/^\+ \d+ cartas$/)).not.toBeInTheDocument();
    const first = rows[0]!;
    expect(within(first).getByText('Alpha Rampage (Vermelho)')).toBeInTheDocument();
    expect(within(first).getByText('precisa de 1')).toBeInTheDocument();
    expect(within(within(first).getByRole('group', { name: 'Tenho' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['0', '1']);
    const second = rows[1]!;
    expect(within(within(second).getByRole('group', { name: 'Tenho' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['0', '1', '2', '3']);
    expect(within(second).getByText('R$')).toBeInTheDocument();
    expect(within(second).getByLabelText('Preço por unidade de Bloodrush Bellow (Amarelo)')).toBeInTheDocument();
    const note = within(second).getByLabelText('Observação de Bloodrush Bellow (Amarelo) (edição, condição)');
    expect(note).toHaveAttribute('maxLength', '60');
    expect(note).toHaveAttribute('placeholder', 'Observação (edição, condição)');
    expect(within(rows[26]!).getByText('precisa de 5')).toBeInTheDocument();

    // A store sees no sign-up prompt, and nothing of Cúpula DT.
    expect(screen.queryByText(/Criar conta/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('shared-signup-prompt')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/C[uú]pula|Esta página não aparece em buscas/);
    expect(screen.getByTestId('shared-deck-footer')).toHaveTextContent('Legend Story Studios');
  });

  it('sends nothing typed and records only quote_sent', async () => {
    const user = userEvent.setup();
    renderQuote();
    const alpha = screen.getAllByTestId('quote-row')[0]!;

    await user.click(within(alpha).getByRole('button', { name: 'Tenho 1 de Alpha Rampage (Vermelho)' }));
    await user.type(within(alpha).getByLabelText('Preço por unidade de Alpha Rampage (Vermelho)'), '120,00');
    await user.type(within(alpha).getByLabelText(/^Observação de Alpha/), 'Edição promo, condição NM');
    expect(api.calls).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Ver mensagem e enviar' }));

    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.calls[0]).toEqual({ key: `POST /shared/decks/${TOKEN}/events`, body: { kind: 'quote_sent' } });
  });

  it('keeps what was typed for the next visit to the same address', async () => {
    const user = userEvent.setup();
    const first = renderQuote();
    const alpha = screen.getAllByTestId('quote-row')[0]!;
    await user.click(within(alpha).getByRole('button', { name: 'Tenho 1 de Alpha Rampage (Vermelho)' }));
    await user.type(within(alpha).getByLabelText('Preço por unidade de Alpha Rampage (Vermelho)'), '120,00');
    first.unmount();

    renderQuote();

    const restored = screen.getAllByTestId('quote-row')[0]!;
    expect(within(restored).getByLabelText('Preço por unidade de Alpha Rampage (Vermelho)')).toHaveValue('120,00');
    expect(within(restored).getByRole('button', { name: 'Tenho 1 de Alpha Rampage (Vermelho)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Seu orçamento: 1 de 59 cópias · R$ 120,00')).toBeInTheDocument();
  });

  it('still works when the browser blocks storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    renderQuote();
    const alpha = screen.getAllByTestId('quote-row')[0]!;

    await user.click(within(alpha).getByRole('button', { name: 'Tenho 1 de Alpha Rampage (Vermelho)' }));

    expect(screen.getByText('Seu orçamento: 1 de 59 cópias · R$ 0,00')).toBeInTheDocument();
  });

  describe('with the rows filled in', () => {
    beforeEach(() => {
      // 18 of 59 copies for R$ 412,00.
      writeQuoteDraft(TOKEN, {
        'alpha-rampage-red': { have: 1, price: '120,00', note: 'Edição promo, condição NM' },
        'bloodrush-bellow-yellow': { have: 2, price: '60,00', note: '' },
        'reckless-swing-blue': { have: 3, price: '8,00', note: '' },
        'pack-hunt-red': { have: 3, price: '2,00', note: '' },
        'filler-0': { have: 3, price: '20,00', note: '' },
        'filler-1': { have: 3, price: '20,00', note: '' },
        'filler-2': { have: 2, price: '10,00', note: '' },
        'filler-3': { have: 1, price: '2,00', note: '' },
      });
    });

    it('sends the quote on WhatsApp or copies it', async () => {
      const user = userEvent.setup();
      const first = renderQuote();
      expect(screen.getByText('Seu orçamento: 18 de 59 cópias · R$ 412,00')).toBeInTheDocument();
      const preview = screen.getByTestId('quote-preview');
      expect(preview).toHaveTextContent('Oi Caio, orçamento para o seu deck [CC] Brute do Caio:');
      expect(preview).toHaveTextContent('1x Alpha Rampage (Vermelho) · R$ 120,00 cada · Edição promo, condição NM');
      expect(preview).toHaveTextContent('Total: 18 de 59 cópias · R$ 412,00');

      await user.click(screen.getByRole('button', { name: 'Ver mensagem e enviar' }));

      expect(open).toHaveBeenCalledTimes(1);
      const sent = String(open.mock.calls[0]![0]);
      expect(sent.startsWith('https://wa.me/5551999990000?text=')).toBe(true);
      const text = decodeURIComponent(sent.split('?text=')[1]!);
      expect(text.split('\n')[0]).toBe('Oi Caio, orçamento para o seu deck [CC] Brute do Caio:');
      expect(text).toContain('1x Alpha Rampage (Vermelho) · R$ 120,00 cada · Edição promo, condição NM');
      expect(text.split('\n').at(-1)).toBe('Total: 18 de 59 cópias · R$ 412,00');
      first.unmount();

      // With no number on the link the text is copied instead.
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      open.mockClear();
      renderQuote({ ...QUOTE, contactWhatsapp: null });
      await user.click(screen.getByRole('button', { name: 'Ver mensagem e enviar' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(text));
      expect(open).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success', message: 'Texto copiado. Cole na conversa com Caio.' }));
    });
  });

  it('copies the list for a spreadsheet', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderQuote({ ...QUOTE, needed: [item('pack-hunt-red', 'Pack Hunt', 1, 3), item('nullrune-hood', 'Nullrune Hood', null, 1)] });

    await user.click(screen.getByRole('button', { name: 'Copiar a lista para a sua planilha' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('3\tPack Hunt\tVermelho\n1\tNullrune Hood\t'));
    expect(api.calls).toEqual([]);
  });

  it('does not offer to send until a card is marked', () => {
    renderQuote();

    expect(screen.getByRole('button', { name: 'Ver mensagem e enviar' })).toBeDisabled();
    expect(screen.getByText('Seu orçamento: 0 de 59 cópias · R$ 0,00')).toBeInTheDocument();
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError, createFakeApi, makeAuth, renderWithProviders, SIGNED_IN_USER, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { DUDA_ROWS } from './spareKit';
import { rowKey } from '../spareModel';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const toast = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: toast.show }) }));

import { SellDraft } from '../SellDraft';

const CLOSING = 'Aceito PIX · retirada na loja do centro ou envio pelos Correios';
const TODAY = new Date(2026, 9, 21);

/** Duda's choice of `r3-spare-page-phone`: 9 copies in 5 lines, R$ 186. */
const CHOSEN: Record<string, number> = Object.fromEntries(
  ([[0, 1], [1, 2], [2, 1], [3, 2], [4, 3]] as const).map(([index, quantity]) => [rowKey(DUDA_ROWS[index]!), quantity] as const),
);
// The page shows the rows by price, highest first, and hands them to the draft in that order.
const ROWS = [...DUDA_ROWS].sort((a, b) => (b.suggestedCents ?? 0) - (a.suggestedCents ?? 0));

function serveCreate(api: IFakeApi): void {
  api.handlers.set('POST /lists', () => ({ id: 7, kind: 'sell', name: 'Vendo - 21/10', lines: [] }));
  api.handlers.set('POST /lists/7/lines', () => ({ id: 7, lines: [] }));
  api.handlers.set('POST /lists/7/share', () => ({ intent: 'sell', url: 'https://rathearsenal.app/l/k7Qm2x', token: 'k7Qm2x', showContact: true }));
  api.handlers.set('PATCH /users/me/sell-closing-line', ({ body }) => ({ text: (body as { text: string }).text }));
}

function renderDraft(options: { closing?: string | null; onSent?: () => void } = {}) {
  const user = { ...SIGNED_IN_USER, displayName: 'Duda', sellClosingLine: options.closing ?? null };
  return renderWithProviders(
    <SellDraft rows={ROWS} chosen={CHOSEN} onBack={vi.fn()} onSent={options.onSent ?? vi.fn()} today={TODAY} />,
    makeAuth({ user, setSellClosingLine: vi.fn() }),
  );
}

const lines = (): HTMLElement[] => screen.getAllByTestId('draft-line');

beforeEach(() => {
  apiRef.current = createFakeApi();
  toast.show.mockReset();
});

describe('SellDraft', () => {
  it('the draft shows the name, prices, questions, closing line, total and the live message', async () => {
    renderDraft({ closing: CLOSING });

    const draft = screen.getByTestId('sell-draft');
    const text = draft.textContent ?? '';
    const inOrder = [
      '‹ Sobrando',
      'Nome da lista',
      '3 linhas sem versão informada. Elas existem em foil, e foil vale mais:',
      'Sim, todas sem foil',
      'Sugerido: TCGplayer em dólar × 7.',
      'Sua linha final',
      'Incluir o total',
      'Mensagem',
      'VENDO',
      'Total: R$ 186 (9 cartas)',
      'Ao enviar, a lista Vendo - 21/10 fica salva em Listas, com o link.',
      'Enviar no WhatsApp',
      'Copiar texto',
    ];
    const positions = inOrder.map((entry) => text.indexOf(entry));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    expect(screen.getByLabelText('Nome da lista')).toHaveValue('Vendo - 21/10');
    expect(screen.getByRole('switch', { name: 'Incluir o total' })).toBeChecked();
    expect(lines()).toHaveLength(5);
    expect(lines()[0]).toHaveTextContent('1 Enlightened Strike (Vermelho)');
    expect(within(lines()[1]!).getByRole('textbox', { name: /Preço de Command and Conquer/ })).toHaveValue('45');
    expect(within(lines()[1]!).getByText('cada')).toBeInTheDocument();
    expect(within(lines()[0]!).queryByText('cada')).toBeNull();
    for (const line of lines()) expect(within(line).getByText('Ver na LigaFAB')).toBeInTheDocument();

    const preview = screen.getByTestId('sell-message');
    expect(preview).toHaveTextContent('2x Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45 cada');
    expect(preview).toHaveTextContent('1x Enlightened Strike (Vermelho) · foil não conferido · R$ 12');

    // A new price and a new closing line change the preview at once.
    const price = within(lines()[1]!).getByRole('textbox', { name: /Preço de Command and Conquer/ });
    await userEvent.clear(price);
    await userEvent.type(price, '50');
    expect(preview).toHaveTextContent('R$ 50 cada');
    expect(preview).toHaveTextContent('Total: R$ 196 (9 cartas)');
    const closing = screen.getByLabelText('Sua linha final');
    await userEvent.clear(closing);
    await userEvent.type(closing, 'Só PIX');
    expect(preview).toHaveTextContent('Só PIX');
    expect(preview).not.toHaveTextContent('Aceito PIX');
  });

  it('asks the finish only of lines with no finish of cards that exist in foil', async () => {
    renderDraft();

    const questions = screen.getByTestId('finish-questions');
    expect(within(questions).getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual([
      'Foil de Enlightened Strike (Vermelho)',
      'Foil de Snatch (Vermelho)',
      'Foil de Pummel (Vermelho)',
    ]);
    expect(within(questions).queryAllByRole('button', { pressed: true })).toHaveLength(0);
    expect(within(questions).getAllByRole('button', { name: 'Sem foil' })).toHaveLength(3);
    expect(within(questions).getAllByRole('button', { name: 'Foil' })).toHaveLength(3);
    expect(within(questions).getAllByRole('button', { name: 'Não sei' })).toHaveLength(3);
    expect(within(questions).queryByText(/Command and Conquer/)).toBeNull();

    await userEvent.click(within(questions).getByRole('button', { name: 'Sim, todas sem foil' }));

    for (const chip of within(questions).getAllByRole('button', { name: 'Sem foil' })) expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(lines()[2]).toHaveTextContent('sem foil · preço aproximado');
    expect(screen.getByTestId('sell-message')).toHaveTextContent('1x Enlightened Strike (Vermelho) · sem foil · R$ 12');
    expect(screen.getByTestId('sell-message')).not.toHaveTextContent('foil não conferido');
  });

  it('the closing line is empty the first time, then the last one in full', () => {
    const first = renderDraft({ closing: null });
    const field = screen.getByLabelText('Sua linha final');
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', expect.stringMatching(/^Ex\.: /));
    first.unmount();

    renderDraft({ closing: CLOSING });
    expect(screen.getByLabelText('Sua linha final')).toHaveValue(CLOSING);
    expect(screen.getByTestId('sell-draft').textContent).not.toContain('da última vez');
  });

  it('the price helper explains the multiplier once', () => {
    renderDraft();

    const helper = 'Sugerido: TCGplayer em dólar × 7. O 7 cobre o dólar e o custo de trazer a carta; mude se você cobra diferente.';
    expect(screen.getAllByText(helper)).toHaveLength(1);
  });

  it("marks approximate prices on the seller's screen only", async () => {
    renderDraft({ closing: CLOSING });

    expect(lines()[2]).toHaveTextContent('versão não informada · preço aproximado');
    expect(lines()[3]).toHaveTextContent('versão não informada · preço aproximado');
    expect(lines()[0]).not.toHaveTextContent('preço aproximado');
    expect(lines()[1]).not.toHaveTextContent('preço aproximado');
    expect(screen.getByTestId('sell-message')).not.toHaveTextContent('preço aproximado');

    await userEvent.click(within(screen.getByTestId('finish-questions')).getAllByRole('button', { name: 'Sem foil' })[0]!);
    expect(lines()[2]).toHaveTextContent('sem foil · preço aproximado');
    expect(screen.getByTestId('sell-message')).not.toHaveTextContent('preço aproximado');
  });

  it('sending creates the sell list, shares it and saves the closing line', async () => {
    const api = apiRef.current!;
    serveCreate(api);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onSent = vi.fn();
    renderDraft({ closing: CLOSING, onSent });
    await userEvent.click(within(screen.getByTestId('finish-questions')).getByRole('button', { name: 'Sim, todas sem foil' }));

    await userEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(7));
    const keys = api.calls.map((call) => call.key);
    expect(keys).toEqual([
      'POST /lists',
      ...Array<string>(5).fill('POST /lists/7/lines'),
      'POST /lists/7/share',
      'PATCH /users/me/sell-closing-line',
    ]);
    expect(api.calls[0]!.body).toEqual({ kind: 'sell', name: 'Vendo - 21/10' });
    expect(api.calls[1]!.body).toEqual({
      cardIdentifier: 'enlightened-strike-red',
      quantity: 1,
      printingCode: '',
      edition: '',
      finish: 'rainbow',
      condition: 'NM',
      priceCents: 6000,
    });
    expect(api.calls[2]!.body).toMatchObject({ cardIdentifier: 'command-and-conquer-red', quantity: 2, printingCode: 'HP1001', finish: '', condition: 'NM', priceCents: 4500 });
    expect(api.calls[3]!.body).toMatchObject({ cardIdentifier: 'enlightened-strike-red', quantity: 1, finish: 'none', priceCents: 1200 });
    expect(api.calls.at(-1)!.body).toEqual({ text: CLOSING });
    expect(open).toHaveBeenCalledTimes(1);
    const address = String(open.mock.calls[0]![0]);
    expect(address.startsWith('https://wa.me/?text=')).toBe(true);
    const sent = decodeURIComponent(address.slice('https://wa.me/?text='.length));
    expect(sent).toContain('VENDO');
    expect(sent).toContain('https://rathearsenal.app/l/k7Qm2x?v=');
    open.mockRestore();
  });

  it('copies the text instead of opening WhatsApp, and says the list was saved', async () => {
    serveCreate(apiRef.current!);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onSent = vi.fn();
    renderDraft({ closing: CLOSING, onSent });

    await userEvent.click(screen.getByRole('button', { name: 'Copiar texto' }));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(7));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://rathearsenal.app/l/k7Qm2x?v='));
    expect(open).not.toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith({ kind: 'success', message: 'Texto copiado. A lista ficou salva em Listas.' });
    open.mockRestore();
  });

  it('opens no WhatsApp and keeps the draft when the list cannot be created', async () => {
    const api = apiRef.current!;
    api.handlers.set('POST /lists', () => {
      throw apiError(500, null);
    });
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const onSent = vi.fn();
    renderDraft({ closing: CLOSING, onSent });

    await userEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível criar a lista. Tente de novo.');
    expect(open).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    expect(screen.getByTestId('sell-draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Sua linha final')).toHaveValue(CLOSING);
    open.mockRestore();
  });

  it('a retry after a failed step never makes a second list', async () => {
    const api = apiRef.current!;
    serveCreate(api);
    let failShare = true;
    api.handlers.set('POST /lists/7/share', () => {
      if (failShare) throw apiError(500, null);
      return { intent: 'sell', url: 'https://rathearsenal.app/l/k7Qm2x', token: 'k7Qm2x', showContact: true };
    });
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    renderDraft({ closing: CLOSING });

    await userEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
    await screen.findByRole('alert');
    failShare = false;
    await userEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(api.calls.filter((call) => call.key === 'POST /lists')).toHaveLength(1);
    expect(api.calls.filter((call) => call.key === 'POST /lists/7/lines')).toHaveLength(5);
    open.mockRestore();
  });
});

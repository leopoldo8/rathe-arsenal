import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listsQueryKey, type ICardList, type IListSummary } from '../../../api/lists';
import type { IListLinkState } from '../../../api/shared-lists';
import {
  apiError,
  createFakeApi,
  makeAuth,
  renderWithProviders,
  SIGNED_IN_USER,
  type IFakeApi,
} from '../../shared-deck/__tests__/sharingTestKit';
import { makeLine, makeList, makeSummary } from './listsTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

import { ListShareDialog } from '../ListShareDialog';

const TOKEN = 'aB3dE5gH7jK9mN';
const URL = `https://rathearsenal.app/l/${TOKEN}`;
function versioned(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=[0-9a-z]+$`);
}

function whatsappText(element: HTMLElement): string {
  return decodeURIComponent((element.getAttribute('href') ?? '').replace('https://wa.me/?text=', ''));
}

const link = (intent: 'want' | 'sell', showContact = false): IListLinkState => ({ intent, url: URL, token: TOKEN, showContact });

const WANT = makeList({
  kind: 'want',
  name: 'Faltam pro Oscilio',
  lines: [makeLine({ id: 1, quantity: 3 }), makeLine({ id: 2, name: 'Snatch', quantity: 2 })],
});
const SELL = makeList({
  kind: 'sell',
  totalPriceCents: 42000,
  lines: [
    makeLine({ id: 1, quantity: 1, condition: 'NM', priceCents: 600 }),
    makeLine({ id: 2, name: 'Snatch', quantity: 2 }),
    makeLine({ id: 3, name: 'Remembrance', pitch: null, sold: true, priceCents: 5500 }),
  ],
});

function renderDialog(list: ICardList, auth = makeAuth()) {
  return renderWithProviders(<ListShareDialog list={list} open onOpenChange={vi.fn()} />, auth);
}

describe('ListShareDialog', () => {
  let api: IFakeApi;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set('GET /lists/7/share', () => null);
    api.handlers.set('GET /lists', () => []);
  });

  it('turns the link on and shows the address, WhatsApp, contact switch and the small actions', async () => {
    api.handlers.set('POST /lists/7/share', () => link('want'));
    renderDialog(WANT);

    expect(((await screen.findByTestId('share-address')) as HTMLInputElement).value).toMatch(versioned(URL));
    expect(api.calls.find((call) => call.key === 'POST /lists/7/share')?.body).toEqual({});
    expect(screen.getByRole('heading', { name: 'Compartilhar lista' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.getByTestId('share-whatsapp')).toHaveTextContent('Enviar no WhatsApp');
    expect(screen.getByTestId('list-share-contact')).toBeInTheDocument();
    expect(screen.getByTestId('share-download')).toHaveTextContent('Baixar imagem da lista');
    expect(screen.getByTestId('share-download')).toHaveAttribute('href', `/api/shared/lists/${TOKEN}/image?download=1`);
    expect(screen.getByTestId('share-turn-off')).toHaveTextContent('Desativar link');
    expect(screen.queryByTestId('share-intent-deck')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-back')).not.toBeInTheDocument();
  });

  it('sends a want list on WhatsApp as the cards in text, then the address', async () => {
    api.handlers.set('POST /lists/7/share', () => link('want'));
    renderDialog(WANT);

    const whatsapp = await screen.findByTestId('share-whatsapp');

    expect(whatsappText(whatsapp)).toMatch(versioned(`Comprando essas cartas:\n3x Pummel (Vermelho)\n2x Snatch (Vermelho)\n\n${URL}`));
  });

  it('sends a sell list with condition, price and set price, leaving the sold card out', async () => {
    api.handlers.set('POST /lists/7/share', () => link('sell'));
    renderDialog(SELL);

    const whatsapp = await screen.findByTestId('share-whatsapp');

    expect(whatsappText(whatsapp)).toMatch(
      versioned(`Vendendo essas cartas:\n1x Pummel (Vermelho) · NM · R$ 6,00 cada\n2x Snatch (Vermelho)\n\nTudo por R$ 420,00\n\n${URL}`),
    );
  });

  it('does not make a second link when the list is already shared', async () => {
    api.handlers.set('GET /lists/7/share', () => link('want'));
    renderDialog(WANT);

    expect(((await screen.findByTestId('share-address')) as HTMLInputElement).value).toMatch(versioned(URL));
    expect(api.calls.some((call) => call.key === 'POST /lists/7/share')).toBe(false);
  });

  it('asks the name first only when the user has none', async () => {
    const setDisplayName = vi.fn();
    api.handlers.set('PATCH /users/me/display-name', ({ body }) => ({ displayName: (body as { displayName: string }).displayName }));
    api.handlers.set('POST /lists/7/share', () => link('want'));
    renderDialog(WANT, makeAuth({ user: { ...SIGNED_IN_USER, displayName: null }, setDisplayName }));

    expect(await screen.findByText('Que nome os outros jogadores vão ver?')).toBeInTheDocument();
    expect(api.calls.some((call) => call.key === 'POST /lists/7/share')).toBe(false);
    await userEvent.type(screen.getByLabelText('Seu nome'), 'Dudu');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(setDisplayName).toHaveBeenCalledWith('Dudu');
    expect(((await screen.findByTestId('share-address')) as HTMLInputElement).value).toMatch(versioned(URL));
  });

  it('falls back to the name step when the API answers DISPLAY_NAME_REQUIRED, then makes the link', async () => {
    let attempts = 0;
    api.handlers.set('POST /lists/7/share', () => {
      attempts += 1;
      if (attempts === 1) throw apiError(409, 'DISPLAY_NAME_REQUIRED');
      return link('want');
    });
    api.handlers.set('PATCH /users/me/display-name', () => ({ displayName: 'Dudu' }));
    renderDialog(WANT);

    await screen.findByText('Que nome os outros jogadores vão ver?');
    await userEvent.clear(screen.getByLabelText('Seu nome'));
    await userEvent.type(screen.getByLabelText('Seu nome'), 'Dudu');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(((await screen.findByTestId('share-address')) as HTMLInputElement).value).toMatch(versioned(URL));
  });

  it('offers a retry when the link cannot be made', async () => {
    let attempts = 0;
    api.handlers.set('POST /lists/7/share', () => {
      attempts += 1;
      if (attempts === 1) throw apiError(500, null);
      return link('want');
    });
    renderDialog(WANT);

    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(((await screen.findByTestId('share-address')) as HTMLInputElement).value).toMatch(versioned(URL));
  });

  it('copies the address', async () => {
    api.handlers.set('GET /lists/7/share', () => link('want'));
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderDialog(WANT);

    await user.click(await screen.findByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(versioned(URL)));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('switches the WhatsApp of the list link', async () => {
    api.handlers.set('GET /lists/7/share', () => link('sell', true));
    api.handlers.set('PATCH /lists/7/share', ({ body }) => link('sell', (body as { showContact: boolean }).showContact));
    renderDialog(SELL, makeAuth({ user: { ...SIGNED_IN_USER, whatsappNumber: '5553999990000' } }));

    await userEvent.click(await screen.findByTestId('list-share-contact-switch'));

    await waitFor(() => expect(screen.getByTestId('list-share-contact-switch')).toHaveAttribute('aria-checked', 'false'));
    expect(api.calls.find((call) => call.key === 'PATCH /lists/7/share')?.body).toEqual({ showContact: false });
  });

  it('asks for the number inline when none is saved', async () => {
    api.handlers.set('GET /lists/7/share', () => link('want'));
    renderDialog(WANT);

    expect(await screen.findByLabelText('Número do WhatsApp')).toBeInTheDocument();
  });

  it('turns the link off after one inline confirm and refreshes the index', async () => {
    api.handlers.set('GET /lists/7/share', () => link('want'));
    api.handlers.set('DELETE /lists/7/share', () => undefined);
    const onOpenChange = vi.fn();
    const { queryClient } = renderWithProviders(<ListShareDialog list={WANT} open onOpenChange={onOpenChange} />);
    queryClient.setQueryData(listsQueryKey, [makeSummary({ id: 7, shared: true }), makeSummary({ id: 8, shared: true })]);

    await userEvent.click(await screen.findByTestId('share-turn-off'));
    expect(screen.getByText('Desativar? Quem tem o link não vai mais conseguir abrir.')).toBeInTheDocument();
    expect(api.calls.some((call) => call.key === 'DELETE /lists/7/share')).toBe(false);
    await userEvent.click(screen.getByTestId('share-turn-off-confirm'));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(api.calls.some((call) => call.key === 'DELETE /lists/7/share')).toBe(true);
    const summaries = queryClient.getQueryData<IListSummary[]>(listsQueryKey);
    expect(summaries?.map((summary) => summary.shared)).toEqual([false, true]);
  });

  it('keeps the link when the owner changes their mind at the confirm', async () => {
    api.handlers.set('GET /lists/7/share', () => link('want'));
    renderDialog(WANT);

    await userEvent.click(await screen.findByTestId('share-turn-off'));
    await userEvent.click(screen.getByRole('button', { name: 'Manter' }));

    expect(screen.getByTestId('share-turn-off')).toBeInTheDocument();
    expect(api.calls.some((call) => call.key === 'DELETE /lists/7/share')).toBe(false);
  });
  it('an unconfirmed owner gets the confirm sheet', async () => {
    api.handlers.set('POST /lists/7/share', () => {
      throw apiError(403, 'EMAIL_NOT_CONFIRMED');
    });
    api.handlers.set('POST /auth/resend-verification', () => undefined);
    const onOpenChange = vi.fn();
    const auth = makeAuth({ user: { ...SIGNED_IN_USER, email: 'bia.souza@gmail.com', emailConfirmed: false } });
    renderWithProviders(<ListShareDialog list={WANT} open onOpenChange={onOpenChange} />, auth);

    expect(await screen.findByRole('heading', { name: 'Falta confirmar o seu e-mail' })).toBeInTheDocument();
    expect(
      screen.getByText('Para criar um link, confirme o e-mail que mandamos para bia.souza@gmail.com. O link vale 7 dias.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Olhe também o spam e a aba Promoções.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Errei o e-mail' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mandar o link de novo' }));
    await waitFor(() => expect(api.calls.some((call) => call.key === 'POST /auth/resend-verification')).toBe(true));

    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  return {
    ...actual,
    authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args),
  };
});

import { DeckShareCard } from '../DeckShareCard';

const TOKEN = 'k7QxN2mTp9aV4wLcAbCdEf';
const URL = `https://rathearsenal.app/d/${TOKEN}`;

describe('DeckShareCard', () => {
  let api: IFakeApi;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('off: says only the owner sees the deck and shows no address or download', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    expect(await screen.findByText('Só você vê este deck')).toBeInTheDocument();
    expect(screen.getByTestId('deck-share-switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('deck-share-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-share-download')).not.toBeInTheDocument();
  });

  it('on: shows the address, the missing-view link, the sharer name and the image download', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    expect(await screen.findByText('Link ativo')).toBeInTheDocument();
    expect(screen.getByTestId('deck-share-switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('deck-share-address')).toHaveValue(URL);
    expect(screen.getByTestId('deck-share-missing-link')).toHaveAttribute('href', `${URL}?view=missing`);
    expect(screen.getByTestId('deck-share-download')).toHaveAttribute(
      'href',
      `/api/shared/decks/${TOKEN}/image?download=1`,
    );
    expect(screen.getByText('Dudu_Pelotas')).toBeInTheDocument();
  });

  it('copies the address and confirms', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    await user.click(await screen.findByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith(URL);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('turning it on posts to the share route and shows the new address', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    api.handlers.set('POST /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    await userEvent.click(await screen.findByTestId('deck-share-switch'));

    expect(await screen.findByTestId('deck-share-address')).toHaveValue(URL);
  });

  it('prompt: asks for a display name on 409, saves it, then retries the share', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    let attempts = 0;
    api.handlers.set('POST /decks/7/share', () => {
      attempts += 1;
      if (attempts === 1) throw apiError(409, 'DISPLAY_NAME_REQUIRED');
      return { url: URL, token: TOKEN, showContact: false };
    });
    api.handlers.set('PATCH /users/me/display-name', ({ body }) => ({
      displayName: (body as { displayName: string }).displayName,
    }));
    const setDisplayName = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />, makeAuth({ user: { ...makeAuth().user!, displayName: null }, setDisplayName }));

    await user.click(await screen.findByTestId('deck-share-switch'));

    expect(await screen.findByText('Antes de ativar, como você quer aparecer?')).toBeInTheDocument();
    expect(screen.getByTestId('deck-share-switch')).toHaveAttribute('aria-checked', 'true');

    const activate = screen.getByRole('button', { name: 'Ativar link' });
    expect(activate).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('Nome de exibição'), '  Dudu  ');
    expect(screen.getByText('8/40')).toBeInTheDocument();
    await user.click(activate);

    expect(await screen.findByTestId('deck-share-address')).toHaveValue(URL);
    expect(api.calls.map((call) => call.key)).toEqual([
      'GET /decks/7/share',
      'POST /decks/7/share',
      'PATCH /users/me/display-name',
      'POST /decks/7/share',
    ]);
    expect(api.calls[2]?.body).toEqual({ displayName: 'Dudu' });
    expect(setDisplayName).toHaveBeenCalledWith('Dudu');
  });

  it('prompt: cancel closes it and leaves sharing off', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    api.handlers.set('POST /decks/7/share', () => {
      throw apiError(409, 'DISPLAY_NAME_REQUIRED');
    });
    const user = userEvent.setup();
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    await user.click(await screen.findByTestId('deck-share-switch'));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByLabelText('Nome de exibição')).not.toBeInTheDocument());
    expect(screen.getByTestId('deck-share-switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('turning it off asks for confirmation first, then deletes the share', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    api.handlers.set('DELETE /decks/7/share', () => undefined);
    const user = userEvent.setup();
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    await user.click(await screen.findByTestId('deck-share-switch'));
    const confirm = screen.getByRole('group', { name: 'Desativar o link?' });
    expect(api.calls.map((call) => call.key)).not.toContain('DELETE /decks/7/share');
    await user.click(within(confirm).getByRole('button', { name: 'Desativar link' }));

    expect(await screen.findByText('Só você vê este deck')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-share-download')).not.toBeInTheDocument();
  });

  it('keeping the link on dismisses the confirmation without calling the API', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    const user = userEvent.setup();
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    await user.click(await screen.findByTestId('deck-share-switch'));
    await user.click(screen.getByRole('button', { name: 'Manter ativo' }));

    expect(screen.getByTestId('deck-share-address')).toBeInTheDocument();
    expect(api.calls.map((call) => call.key)).toEqual(['GET /decks/7/share']);
  });

  it('shows an error when turning on fails for another reason', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    api.handlers.set('POST /decks/7/share', () => {
      throw apiError(500, null);
    });
    renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

    await userEvent.click(await screen.findByTestId('deck-share-switch'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ativar o link');
  });

  describe('WhatsApp contact', () => {
    const withNumber = makeAuth({ user: { ...makeAuth().user!, whatsappNumber: '5553999990000' } });

    it('number saved and switch on: shows the number and a preview with the ready message', async () => {
      api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: true }));
      renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />, withNumber);

      const row = await screen.findByTestId('deck-share-contact');
      expect(within(row).getByTestId('deck-share-contact-switch')).toHaveAttribute('aria-checked', 'true');
      expect(within(row).getByText('Número +55 53 99999-0000')).toBeInTheDocument();
      expect(within(row).getByText(/Oi! Vi seu deck Rhinar Rampage no Rathe Arsenal\./)).toBeInTheDocument();
      expect(within(row).getByText('Chamar Dudu_Pelotas no WhatsApp')).toBeInTheDocument();
    });

    it('turning the switch off patches showContact and says the link shows nothing', async () => {
      api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: true }));
      api.handlers.set('PATCH /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
      renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />, withNumber);

      await userEvent.click(await screen.findByTestId('deck-share-contact-switch'));

      expect(await screen.findByText('Desligado. O link não mostra seu número nem o botão.')).toBeInTheDocument();
      expect(api.calls.find((call) => call.key === 'PATCH /decks/7/share')?.body).toEqual({ showContact: false });
    });

    it('no number: the switch is disabled and the inline field is offered', async () => {
      api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: true }));
      renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

      const row = await screen.findByTestId('deck-share-contact');
      expect(within(row).getByTestId('deck-share-contact-switch')).toHaveAttribute('aria-checked', 'false');
      expect(within(row).getByTestId('deck-share-contact-switch')).toHaveAttribute('aria-disabled', 'true');
      expect(within(row).getByText('Adicione um número para ligar.')).toBeInTheDocument();
      expect(within(row).getByLabelText('Número do WhatsApp (opcional)')).toBeInTheDocument();
    });

    it('no number: saves it, mirrors it into the user and turns the link switch on', async () => {
      api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
      api.handlers.set('PATCH /users/me/contact', () => ({ whatsappNumber: '5553999990000' }));
      api.handlers.set('PATCH /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: true }));
      const setWhatsappNumber = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />, makeAuth({ setWhatsappNumber }));

      await user.type(await screen.findByLabelText('Número do WhatsApp (opcional)'), '53 99999-0000');
      await user.click(screen.getByRole('button', { name: 'Salvar e mostrar' }));

      await waitFor(() => expect(setWhatsappNumber).toHaveBeenCalledWith('5553999990000'));
      expect(api.calls.find((call) => call.key === 'PATCH /users/me/contact')?.body).toEqual({
        whatsappNumber: '53 99999-0000',
      });
      await waitFor(() =>
        expect(api.calls.find((call) => call.key === 'PATCH /decks/7/share')?.body).toEqual({ showContact: true }),
      );
    });

    it('no number: an incomplete number shows the hint without calling the API', async () => {
      api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
      const user = userEvent.setup();
      renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

      await user.type(await screen.findByLabelText('Número do WhatsApp (opcional)'), '53 9999');
      await user.click(screen.getByRole('button', { name: 'Salvar e mostrar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Número incompleto');
      expect(api.calls.some((call) => call.key === 'PATCH /users/me/contact')).toBe(false);
    });

    it('no number: shows the hint when the API answers 400', async () => {
      api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
      api.handlers.set('PATCH /users/me/contact', () => {
        throw apiError(400, null);
      });
      const user = userEvent.setup();
      renderWithProviders(<DeckShareCard deckId={7} deckName="Rhinar Rampage" />);

      await user.type(await screen.findByLabelText('Número do WhatsApp (opcional)'), '53 99999-0000');
      await user.click(screen.getByRole('button', { name: 'Salvar e mostrar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Número incompleto');
    });
  });
});

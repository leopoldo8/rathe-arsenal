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
    renderWithProviders(<DeckShareCard deckId={7} />);

    expect(await screen.findByText('Só você vê este deck')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByTestId('deck-share-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deck-share-download')).not.toBeInTheDocument();
  });

  it('on: shows the address, the missing-view link, the sharer name and the image download', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    renderWithProviders(<DeckShareCard deckId={7} />);

    expect(await screen.findByText('Link ativo')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
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
    renderWithProviders(<DeckShareCard deckId={7} />);

    await user.click(await screen.findByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith(URL);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('turning it on posts to the share route and shows the new address', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    api.handlers.set('POST /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    renderWithProviders(<DeckShareCard deckId={7} />);

    await userEvent.click(await screen.findByRole('switch'));

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
    renderWithProviders(<DeckShareCard deckId={7} />, makeAuth({ user: { ...makeAuth().user!, displayName: null }, setDisplayName }));

    await user.click(await screen.findByRole('switch'));

    expect(await screen.findByText('Antes de ativar, como você quer aparecer?')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');

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
    renderWithProviders(<DeckShareCard deckId={7} />);

    await user.click(await screen.findByRole('switch'));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByLabelText('Nome de exibição')).not.toBeInTheDocument());
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('turning it off asks for confirmation first, then deletes the share', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    api.handlers.set('DELETE /decks/7/share', () => undefined);
    const user = userEvent.setup();
    renderWithProviders(<DeckShareCard deckId={7} />);

    await user.click(await screen.findByRole('switch'));
    const confirm = screen.getByRole('group', { name: 'Desativar o link?' });
    expect(api.calls.map((call) => call.key)).not.toContain('DELETE /decks/7/share');
    await user.click(within(confirm).getByRole('button', { name: 'Desativar link' }));

    expect(await screen.findByText('Só você vê este deck')).toBeInTheDocument();
    expect(screen.queryByTestId('deck-share-download')).not.toBeInTheDocument();
  });

  it('keeping the link on dismisses the confirmation without calling the API', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: URL, token: TOKEN, showContact: false }));
    const user = userEvent.setup();
    renderWithProviders(<DeckShareCard deckId={7} />);

    await user.click(await screen.findByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Manter ativo' }));

    expect(screen.getByTestId('deck-share-address')).toBeInTheDocument();
    expect(api.calls.map((call) => call.key)).toEqual(['GET /decks/7/share']);
  });

  it('shows an error when turning on fails for another reason', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ url: null, token: null, showContact: false }));
    api.handlers.set('POST /decks/7/share', () => {
      throw apiError(500, null);
    });
    renderWithProviders(<DeckShareCard deckId={7} />);

    await userEvent.click(await screen.findByRole('switch'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ativar o link');
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  apiError,
  createFakeApi,
  makeAuth,
  renderWithProviders,
  SIGNED_IN_USER,
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

import { ShareDialog } from '../ShareDialog';
import type { TShareIntent } from '../../../api/shared-decks';

const DECK_URL = 'https://rathearsenal.app/d/k7QxN2mTp9aV4wLcAbCdEf';
const MISSING_URL = 'https://rathearsenal.app/d/mQ8rZ3nUp2bX5yKdFgHjLs';
const link = (intent: TShareIntent, showContact = false) => ({
  intent,
  url: intent === 'deck' ? DECK_URL : MISSING_URL,
  token: intent === 'deck' ? 'k7QxN2mTp9aV4wLcAbCdEf' : 'mQ8rZ3nUp2bX5yKdFgHjLs',
  showContact,
});

function renderDialog(options: { intent?: TShareIntent | null; missingCount?: number; auth?: ReturnType<typeof makeAuth> } = {}) {
  return renderWithProviders(
    <ShareDialog
      deckId={7}
      deckName="Rhinar Rampage"
      missingCount={options.missingCount ?? 11}
      open
      initialIntent={options.intent ?? null}
      onOpenChange={vi.fn()}
    />,
    options.auth ?? makeAuth(),
  );
}

describe('ShareDialog', () => {
  let api: IFakeApi;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set('GET /decks/7/share', () => ({ deck: null, missing: null }));
  });

  it('asks only the name first when the user has none, then the intent', async () => {
    const setDisplayName = vi.fn();
    api.handlers.set('PATCH /users/me/display-name', ({ body }) => ({ displayName: (body as { displayName: string }).displayName }));
    renderDialog({ auth: makeAuth({ user: { ...SIGNED_IN_USER, displayName: null }, setDisplayName }) });

    expect(await screen.findByText('Que nome os outros jogadores vão ver?')).toBeInTheDocument();
    expect(screen.queryByText('Mostrar o deck')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Seu nome'), 'Dudu');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(setDisplayName).toHaveBeenCalledWith('Dudu');
    expect(await screen.findByTestId('share-intent-deck')).toBeInTheDocument();
  });

  it('skips the name step when the user already has a name, and offers both intents', async () => {
    renderDialog();
    expect(await screen.findByTestId('share-intent-deck')).toHaveTextContent('Quem abrir vê todas as cartas do deck.');
    expect(screen.getByTestId('share-intent-missing')).toHaveTextContent('Quem abrir vê só as 11 cartas que faltam.');
    expect(screen.queryByText('Nome de exibição')).not.toBeInTheDocument();
  });

  it('disables the missing option, with a reason, when nothing is missing', async () => {
    renderDialog({ missingCount: 0 });
    const option = await screen.findByTestId('share-intent-missing');
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent('Não falta nenhuma carta.');
  });

  it('marks the intents whose link is on', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ deck: link('deck'), missing: null }));
    renderDialog();
    await waitFor(() => expect(within(screen.getByTestId('share-intent-deck')).getByText('link ativo')).toBeInTheDocument());
    expect(within(screen.getByTestId('share-intent-missing')).queryByText('link ativo')).not.toBeInTheDocument();
  });

  it('choosing an intent turns that link on and shows its address, WhatsApp and the small actions', async () => {
    api.handlers.set('POST /decks/7/share', () => link('missing'));
    renderDialog();

    await userEvent.click(await screen.findByTestId('share-intent-missing'));

    expect(await screen.findByTestId('share-address')).toHaveValue(MISSING_URL);
    expect(api.calls.find((call) => call.key === 'POST /decks/7/share')?.body).toEqual({ intent: 'missing' });
    const whatsapp = screen.getByTestId('share-whatsapp');
    expect(whatsapp).toHaveTextContent('Enviar no WhatsApp');
    expect(whatsapp.getAttribute('href')).toBe(
      `https://wa.me/?text=${encodeURIComponent(`Procuro estas cartas do deck Rhinar Rampage. Quem tem?\n${MISSING_URL}`)}`,
    );
    expect(screen.getByTestId('share-download')).toHaveAttribute('href', '/api/shared/decks/mQ8rZ3nUp2bX5yKdFgHjLs/image?download=1');
    expect(screen.getByTestId('share-turn-off')).toHaveTextContent('Desativar link');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('copies the address', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ deck: link('deck'), missing: null }));
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderDialog({ intent: 'deck' });

    await user.click(await screen.findByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledWith(DECK_URL);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('opened from the shopping-list call to action, lands directly on the missing link', async () => {
    api.handlers.set('POST /decks/7/share', () => link('missing'));
    renderDialog({ intent: 'missing' });

    expect(await screen.findByTestId('share-address')).toHaveValue(MISSING_URL);
    expect(screen.queryByTestId('share-intent-deck')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pedir as cartas que faltam' })).toBeInTheDocument();
  });

  it('goes back to the choice from the link', async () => {
    api.handlers.set('POST /decks/7/share', () => link('deck'));
    renderDialog();
    await userEvent.click(await screen.findByTestId('share-intent-deck'));
    await screen.findByTestId('share-address');

    await userEvent.click(screen.getByTestId('share-back'));

    expect(await screen.findByTestId('share-intent-missing')).toBeInTheDocument();
  });

  it('falls back to the name step when the API answers DISPLAY_NAME_REQUIRED, then retries', async () => {
    let attempts = 0;
    api.handlers.set('POST /decks/7/share', () => {
      attempts += 1;
      if (attempts === 1) throw apiError(409, 'DISPLAY_NAME_REQUIRED');
      return link('deck');
    });
    api.handlers.set('PATCH /users/me/display-name', () => ({ displayName: 'Dudu' }));
    renderDialog();

    await userEvent.click(await screen.findByTestId('share-intent-deck'));
    await screen.findByText('Que nome os outros jogadores vão ver?');
    await userEvent.clear(screen.getByLabelText('Seu nome'));
    await userEvent.type(screen.getByLabelText('Seu nome'), 'Dudu');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByTestId('share-address')).toHaveValue(DECK_URL);
  });

  it('switches the WhatsApp of this link only', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ deck: link('deck', true), missing: link('missing', true) }));
    api.handlers.set('PATCH /decks/7/share/missing', ({ body }) => link('missing', (body as { showContact: boolean }).showContact));
    const auth = makeAuth({ user: { ...SIGNED_IN_USER, whatsappNumber: '5553999990000' } });
    renderDialog({ intent: 'missing', auth });

    await userEvent.click(await screen.findByTestId('deck-share-contact-switch'));

    await waitFor(() => expect(screen.getByTestId('deck-share-contact-switch')).toHaveAttribute('aria-checked', 'false'));
    expect(api.calls.find((call) => call.key === 'PATCH /decks/7/share/missing')?.body).toEqual({ showContact: false });
  });

  it('asks for the number inline when none is saved', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ deck: link('deck'), missing: null }));
    renderDialog({ intent: 'deck' });
    expect(await screen.findByLabelText('Número do WhatsApp')).toBeInTheDocument();
  });

  it('turning the link off asks once, deletes that intent and returns to the choice', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ deck: link('deck'), missing: null }));
    api.handlers.set('DELETE /decks/7/share/deck', () => undefined);
    renderDialog({ intent: 'deck' });

    await userEvent.click(await screen.findByTestId('share-turn-off'));
    expect(screen.getByText('Desativar? Quem tem o link não vai mais conseguir abrir.')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('share-turn-off-confirm'));

    expect(await screen.findByTestId('share-intent-deck')).toBeInTheDocument();
    expect(api.calls.some((call) => call.key === 'DELETE /decks/7/share/deck')).toBe(true);
  });
});

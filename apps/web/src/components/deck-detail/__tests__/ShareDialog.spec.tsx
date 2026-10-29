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
const QUOTE_URL = 'https://rathearsenal.app/d/qT3rZ9nUp2bX5yKdFgHjLs';

function whatsappText(element: HTMLElement): string {
  return decodeURIComponent((element.getAttribute('href') ?? '').replace('https://wa.me/?text=', ''));
}
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

  it('skips the name step when the user already has a name, and offers the intents', async () => {
    renderDialog();
    expect(await screen.findByTestId('share-intent-deck')).toHaveTextContent('Quem abrir vê todas as cartas do deck.');
    expect(screen.queryByText('Nome de exibição')).not.toBeInTheDocument();
  });

  it('offers the three intents with their lines', async () => {
    renderDialog();

    const options = await screen.findAllByTestId(/^share-intent-/);

    expect(options.map((option) => option.getAttribute('data-testid'))).toEqual([
      'share-intent-deck',
      'share-intent-missing',
      'share-intent-quote',
    ]);
    expect(screen.getByRole('heading', { name: 'Compartilhar' })).toBeInTheDocument();
    expect(options[0]).toHaveTextContent('Mostrar o deck');
    expect(options[0]).toHaveTextContent('Quem abrir vê todas as cartas do deck.');
    expect(options[1]).toHaveTextContent('Pedir as cartas que faltam');
    expect(options[1]).toHaveTextContent('Para o grupo ou para amigos. Mostra o que falta, e quem tiver a carta te responde no WhatsApp.');
    expect(options[2]).toHaveTextContent('Pedir orçamento a uma loja');
    expect(options[2]).toHaveTextContent('Só as cartas que faltam, sem preços. A loja marca quais tem e quanto custa, e te responde no WhatsApp.');
    for (const option of options) expect(option).not.toHaveAttribute('aria-pressed');
    expect(api.calls.some((call) => call.key.startsWith('POST'))).toBe(false);
  });

  it('disables the missing and quote options, with a reason, when nothing is missing', async () => {
    renderDialog({ missingCount: 0 });
    for (const id of ['share-intent-missing', 'share-intent-quote']) {
      const option = await screen.findByTestId(id);
      expect(option).toBeDisabled();
      expect(option).toHaveTextContent('Não falta nenhuma carta.');
    }
  });

  it('draws no badge on a link that is already on, and offers it again like the others', async () => {
    api.handlers.set('GET /decks/7/share', () => ({ deck: link('deck'), missing: null }));
    renderDialog();
    const deckOption = await screen.findByTestId('share-intent-deck');
    await waitFor(() => expect(api.calls.some((call) => call.key === 'GET /decks/7/share')).toBe(true));
    expect(within(deckOption).queryByText('link ativo')).not.toBeInTheDocument();
    expect(deckOption).toBeEnabled();
  });

  it('choosing the deck intent turns that link on and shows its address, WhatsApp and the small actions', async () => {
    api.handlers.set('POST /decks/7/share', () => link('deck'));
    renderDialog();

    await userEvent.click(await screen.findByTestId('share-intent-deck'));

    await screen.findByTestId('share-address');
    expect(api.calls.find((call) => call.key === 'POST /decks/7/share')?.body).toEqual({ intent: 'deck' });
    const whatsapp = screen.getByTestId('share-whatsapp');
    expect(whatsapp).toHaveTextContent('Enviar no WhatsApp');
    expect(whatsappText(whatsapp)).toBe(`Olha meu deck Rhinar Rampage no Rathe Arsenal:\n${DECK_URL}`);
    const download = screen.getByTestId('share-download');
    expect(download).toHaveTextContent('Baixar imagem do deck');
    expect(download).toHaveAttribute('href', '/api/shared/decks/k7QxN2mTp9aV4wLcAbCdEf/image?download=1');
    expect(screen.getByTestId('share-turn-off')).toHaveTextContent('Desativar link');
  });

  it('choosing the missing intent turns that link on and opens the message for the group', async () => {
    api.handlers.set('POST /decks/7/share', () => link('missing'));
    api.handlers.set('GET /shared/decks/mQ8rZ3nUp2bX5yKdFgHjLs', () => ({
      hero: 'Rhinar, Reckless Rampage',
      url: MISSING_URL,
      missing: [
        { cardIdentifier: 'gauntlet', name: 'Goliath Gauntlet', pitch: null, type: 'Equipment', slot: 'equipment', quantity: 1, imageUrl: null, state: 'not_on_site' },
        { cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, type: 'Action - Attack', slot: 'mainboard', quantity: 2, imageUrl: null, state: 'store_lacks' },
      ],
    }));
    renderDialog();

    await userEvent.click(await screen.findByTestId('share-intent-missing'));

    const message = await screen.findByTestId('group-ask-message');
    expect(api.calls.find((call) => call.key === 'POST /decks/7/share')?.body).toEqual({ intent: 'missing' });
    expect(screen.getByRole('heading', { name: 'Pedir as cartas que faltam' })).toBeInTheDocument();
    // The title stands alone: no eyebrow above it repeats the words.
    expect(screen.getAllByText('Pedir as cartas que faltam')).toHaveLength(1);
    expect(message).toHaveTextContent('Procuro estas cartas para o meu deck Rhinar Rampage (Rhinar):');
    expect(message).toHaveTextContent('2 Pack Hunt (Vermelho)');
    expect(message).toHaveTextContent('Também procuro: 1 Goliath Gauntlet.');
    expect(message).toHaveTextContent(new RegExp(`Lista completa: ${MISSING_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=[0-9a-z]+`));
    expect(screen.getByRole('button', { name: 'Abrir no WhatsApp' })).toBeInTheDocument();
  });

  it('the quote intent offers its address with the request text', async () => {
    const quoteLink = { intent: 'quote' as const, url: QUOTE_URL, token: 'qT3rZ9nUp2bX5yKdFgHjLs', showContact: true };
    api.handlers.set('POST /decks/7/share', () => quoteLink);
    renderDialog();

    await userEvent.click(await screen.findByTestId('share-intent-quote'));

    expect(await screen.findByTestId('share-address')).toHaveValue(QUOTE_URL);
    expect(api.calls.find((call) => call.key === 'POST /decks/7/share')?.body).toEqual({ intent: 'quote' });
    expect(screen.getByRole('heading', { name: 'Pedir orçamento a uma loja' })).toBeInTheDocument();
    expect(whatsappText(screen.getByTestId('share-whatsapp'))).toBe(`Oi! Pode me passar um orçamento destas cartas? ${QUOTE_URL}`);
  });

  it('asks again for the same quote address and gets the one it already has', async () => {
    const quoteLink = { intent: 'quote' as const, url: QUOTE_URL, token: 'qT3rZ9nUp2bX5yKdFgHjLs', showContact: true };
    api.handlers.set('POST /decks/7/share', () => quoteLink);
    renderDialog();
    await userEvent.click(await screen.findByTestId('share-intent-quote'));
    await screen.findByTestId('share-address');
    await userEvent.click(screen.getByTestId('share-back'));

    await userEvent.click(await screen.findByTestId('share-intent-quote'));

    expect(await screen.findByTestId('share-address')).toHaveValue(QUOTE_URL);
    expect(api.calls.filter((call) => call.key === 'POST /decks/7/share').length).toBeLessThanOrEqual(1);
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

    expect(screen.getByRole('heading', { name: 'Pedir as cartas que faltam' })).toBeInTheDocument();
    expect(screen.queryByTestId('share-intent-deck')).not.toBeInTheDocument();
    await waitFor(() => expect(api.calls.some((call) => call.key === 'POST /decks/7/share')).toBe(true));
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
    api.handlers.set('PATCH /decks/7/share/deck', ({ body }) => link('deck', (body as { showContact: boolean }).showContact));
    const auth = makeAuth({ user: { ...SIGNED_IN_USER, whatsappNumber: '5553999990000' } });
    renderDialog({ intent: 'deck', auth });

    await userEvent.click(await screen.findByTestId('deck-share-contact-switch'));

    await waitFor(() => expect(screen.getByTestId('deck-share-contact-switch')).toHaveAttribute('aria-checked', 'false'));
    expect(api.calls.find((call) => call.key === 'PATCH /decks/7/share/deck')?.body).toEqual({ showContact: false });
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
  it('an unconfirmed owner gets the confirm sheet', async () => {
    api.handlers.set('POST /decks/7/share', () => {
      throw apiError(403, 'EMAIL_NOT_CONFIRMED');
    });
    api.handlers.set('POST /auth/resend-verification', () => undefined);
    const onOpenChange = vi.fn();
    const auth = makeAuth({ user: { ...SIGNED_IN_USER, email: 'bia.souza@gmail.com', emailConfirmed: false } });
    renderWithProviders(
      <ShareDialog deckId={7} deckName="Rhinar Rampage" missingCount={11} open initialIntent={null} onOpenChange={onOpenChange} />,
      auth,
    );

    await userEvent.click(await screen.findByTestId('share-intent-deck'));

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

  describe('the missing message step and its way to turn the link off', () => {
    function serveMissing(): void {
      api.handlers.set('GET /decks/7/share', () => ({ deck: null, missing: link('missing') }));
      api.handlers.set('GET /shared/decks/mQ8rZ3nUp2bX5yKdFgHjLs', () => ({
        hero: 'Rhinar, Reckless Rampage',
        url: MISSING_URL,
        missing: [
          { cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, type: 'Action - Attack', slot: 'mainboard', quantity: 2, imageUrl: null, state: 'store_lacks' },
        ],
      }));
    }
    const follows = (first: Node, second: Node): boolean => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    const deletes = (): number => api.calls.filter((call) => call.key === 'DELETE /decks/7/share/missing').length;

    it('the missing message step ends with Desativar link under Abrir no WhatsApp and asks before turning off', async () => {
      serveMissing();
      renderDialog({ intent: 'missing' });
      const message = await screen.findByTestId('group-ask-message');
      const send = screen.getByRole('button', { name: 'Abrir no WhatsApp' });
      const switchRow = screen.getByRole('switch');

      const turnOff = screen.getByRole('button', { name: 'Desativar link' });
      expect(screen.getAllByText('Desativar link')).toHaveLength(1);
      expect(follows(message, switchRow)).toBe(true);
      expect(follows(switchRow, send)).toBe(true);
      expect(follows(send, turnOff)).toBe(true);
      const dialog = screen.getByRole('dialog');
      const controls = within(dialog).getAllByRole('button').filter((button) => follows(send, button));
      expect(controls).toEqual([turnOff]);

      await userEvent.click(turnOff);

      expect(screen.queryByRole('button', { name: 'Desativar link' })).toBeNull();
      const question = screen.getByText('Desativar? Quem tem o link não vai mais conseguir abrir.');
      const confirm = screen.getByRole('button', { name: 'Desativar' });
      const keep = screen.getByRole('button', { name: 'Manter' });
      expect(follows(send, question)).toBe(true);
      expect(follows(question, confirm)).toBe(true);
      expect(follows(confirm, keep)).toBe(true);
      expect(screen.getByTestId('group-ask-message')).toBe(message);
      expect(screen.getByRole('switch')).toBe(switchRow);
      expect(screen.getByRole('button', { name: 'Abrir no WhatsApp' })).toBe(send);
      expect(deletes()).toBe(0);
    });

    it('Manter sends nothing and Desativar sends one delete for the missing link', async () => {
      serveMissing();
      api.handlers.set('DELETE /decks/7/share/missing', () => undefined);
      const onOpenChange = vi.fn();
      renderWithProviders(
        <ShareDialog deckId={7} deckName="Rhinar Rampage" missingCount={11} open initialIntent="missing" onOpenChange={onOpenChange} />,
        makeAuth(),
      );
      await screen.findByTestId('group-ask-message');

      await userEvent.click(screen.getByRole('button', { name: 'Desativar link' }));
      await userEvent.click(screen.getByRole('button', { name: 'Manter' }));
      expect(screen.getByRole('button', { name: 'Desativar link' })).toBeInTheDocument();
      expect(screen.queryByText('Desativar? Quem tem o link não vai mais conseguir abrir.')).toBeNull();
      expect(deletes()).toBe(0);

      await userEvent.click(screen.getByRole('button', { name: 'Desativar link' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(deletes()).toBe(1);
    });

    it('a failed delete keeps the step open with an alert and brings Desativar link back', async () => {
      serveMissing();
      api.handlers.set('DELETE /decks/7/share/missing', () => {
        throw apiError(500, 'SERVER_ERROR');
      });
      const onOpenChange = vi.fn();
      renderWithProviders(
        <ShareDialog deckId={7} deckName="Rhinar Rampage" missingCount={11} open initialIntent="missing" onOpenChange={onOpenChange} />,
        makeAuth(),
      );
      await screen.findByTestId('group-ask-message');

      await userEvent.click(screen.getByRole('button', { name: 'Desativar link' }));
      await userEvent.click(screen.getByRole('button', { name: 'Desativar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível desativar o link. Tente novamente.');
      expect(screen.getByRole('button', { name: 'Desativar link' })).toBeInTheDocument();
      expect(screen.getByTestId('group-ask-message')).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISharedCard, ISharedDeckResponse } from '../../../api/shared-decks';
import { createFakeApi, makeAuth, renderWithProviders, type IFakeApi } from './sharingTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: showToast }) }));

import { SharedMissingGallery } from '../SharedMissingGallery';

const TOKEN = 'mQ8rZ3nUp2bX5yKdFgHjLs';

function card(overrides: Partial<ISharedCard> & Pick<ISharedCard, 'cardIdentifier' | 'name' | 'quantity'>): ISharedCard {
  return { pitch: null, type: 'Action', slot: 'mainboard', imageUrl: null, state: 'store_lacks', availableCopies: null, owned: null, ...overrides };
}

const MISSING: readonly ISharedCard[] = [
  card({ cardIdentifier: 'cast-bones-red', name: 'Cast Bones', pitch: 1, quantity: 3 }),
  card({ cardIdentifier: 'kayo-armed-and-dangerous', name: 'Kayo, Armed and Dangerous', quantity: 1 }),
  card({ cardIdentifier: 'reckless-swing-blue', name: 'Reckless Swing', pitch: 3, quantity: 2 }),
  card({ cardIdentifier: 'savage-sash', name: 'Savage Sash', quantity: 1 }),
];

function deckWith(overrides: Partial<ISharedDeckResponse> = {}): ISharedDeckResponse {
  return {
    intent: 'missing',
    token: TOKEN,
    url: `https://rathearsenal.app/d/${TOKEN}`,
    name: '[CC] Kayo',
    hero: 'Kayo',
    sharerName: 'Caio',
    isOwner: false,
    missing: MISSING,
    missingCount: 7,
    storeSummary: { copies: 0, cents: 0 },
    contactWhatsapp: '5551999990000',
    ...overrides,
  } as unknown as ISharedDeckResponse;
}

function eventsPosted(api: IFakeApi): unknown[] {
  return api.calls.filter((call) => call.key === `POST /shared/decks/${TOKEN}/events`).map((call) => call.body);
}

describe('SharedMissingGallery selection', () => {
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
    vi.restoreAllMocks();
  });

  function render(deck: ISharedDeckResponse = deckWith()) {
    return renderWithProviders(<SharedMissingGallery deck={deck} />, makeAuth({ user: null }));
  }

  function rowOf(name: RegExp): HTMLElement {
    return screen.getAllByTestId('shared-card').find((row) => name.test(row.textContent ?? ''))!;
  }

  it('shows a checkbox on each card, no bar and no stepper until a card is ticked', () => {
    render();

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.queryByTestId('offer-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offer-stepper')).not.toBeInTheDocument();
    expect(screen.getByText('Marque as cartas que você tem')).toBeInTheDocument();
  });

  it('gives the owner no checkbox', () => {
    render(deckWith({ isOwner: true }));

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('ticking a card shows its stepper from 1 up to the copies asked, and the bar counts them', async () => {
    render();
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Marcar Cast Bones (Vermelho)' }));
    const row = rowOf(/Cast Bones/);
    expect(within(row).getByTestId('offer-copies')).toHaveTextContent('3');
    expect(within(row).getByText('de 3')).toBeInTheDocument();
    expect(screen.getByTestId('offer-bar')).toHaveTextContent('1 carta selecionada · 3 cópias');

    const more = within(row).getByRole('button', { name: 'Uma cópia a mais de Cast Bones (Vermelho)' });
    const less = within(row).getByRole('button', { name: 'Uma cópia a menos de Cast Bones (Vermelho)' });
    expect(more).toBeDisabled();
    await user.click(less);
    await user.click(less);
    expect(within(row).getByTestId('offer-copies')).toHaveTextContent('1');
    expect(less).toBeDisabled();
    expect(screen.getByTestId('offer-bar')).toHaveTextContent('1 carta selecionada · 1 cópia');
    await user.click(more);
    expect(within(row).getByTestId('offer-copies')).toHaveTextContent('2');
  });

  it('unticking a card takes it out; "Limpar" clears every card and hides the bar', async () => {
    render();
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Cast Bones (Vermelho)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Savage Sash' }));
    expect(screen.getByTestId('offer-bar')).toHaveTextContent('2 cartas selecionadas · 4 cópias');

    await user.click(screen.getByRole('checkbox', { name: 'Marcar Savage Sash' }));
    expect(screen.getByTestId('offer-bar')).toHaveTextContent('1 carta selecionada · 3 cópias');

    await user.click(screen.getByRole('checkbox', { name: 'Marcar Savage Sash' }));
    await user.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(screen.queryByTestId('offer-bar')).not.toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
  });

  it('three cards with copies build the message in the list order and send it on WhatsApp once', async () => {
    render();
    const user = userEvent.setup();
    // Ticked out of list order on purpose: the message follows the list.
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Reckless Swing (Azul)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Cast Bones (Vermelho)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Kayo, Armed and Dangerous' }));
    await user.click(within(rowOf(/Reckless Swing/)).getByRole('button', { name: /a menos/ }));
    expect(screen.getByTestId('offer-bar')).toHaveTextContent('3 cartas selecionadas · 5 cópias');

    await user.click(screen.getByRole('button', { name: 'Oferecer no WhatsApp' }));
    expect(screen.getByTestId('offer-message')).toHaveTextContent(
      'Oi Caio, vi seu pedido no Rathe Arsenal. Tenho: 3 Cast Bones (Vermelho), edição __, condição __, R$ __ cada 1 Kayo, Armed and Dangerous, edição __, condição __, R$ __ cada 1 Reckless Swing (Azul), edição __, condição __, R$ __ cada',
    );
    await user.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(open).toHaveBeenCalledTimes(1);
    const sent = String(open.mock.calls[0]![0]);
    expect(sent.startsWith('https://wa.me/5551999990000?text=')).toBe(true);
    expect(decodeURIComponent(sent.split('?text=')[1]!)).toBe(
      [
        'Oi Caio, vi seu pedido no Rathe Arsenal. Tenho:',
        '3 Cast Bones (Vermelho), edição __, condição __, R$ __ cada',
        '1 Kayo, Armed and Dangerous, edição __, condição __, R$ __ cada',
        '1 Reckless Swing (Azul), edição __, condição __, R$ __ cada',
      ].join('\n'),
    );
    await waitFor(() => expect(eventsPosted(api)).toEqual([{ kind: 'offer' }]));
  });

  it('one selected card uses the single-card message', async () => {
    render();
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Reckless Swing (Azul)' }));

    await user.click(screen.getByRole('button', { name: 'Oferecer no WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(decodeURIComponent(String(open.mock.calls[0]![0]).split('?text=')[1]!)).toBe(
      'Oi Caio, vi seu pedido no Rathe Arsenal. Tenho 2 Reckless Swing (Azul), edição __, condição __, R$ __ cada.',
    );
    await waitFor(() => expect(eventsPosted(api)).toHaveLength(1));
  });

  it('copies the same text when the link shows no number', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(deckWith({ contactWhatsapp: null }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Marcar Savage Sash' }));

    await user.click(screen.getByRole('button', { name: 'Oferecer no WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Copiar o texto' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('Oi Caio, vi seu pedido no Rathe Arsenal. Tenho 1 Savage Sash, edição __, condição __, R$ __ cada.'),
    );
    expect(open).not.toHaveBeenCalled();
    await waitFor(() => expect(eventsPosted(api)).toHaveLength(1));
  });
});

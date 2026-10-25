import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi, renderWithProviders, makeAuth, type IFakeApi } from './sharingTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: showToast }) }));

import { OfferButton } from '../OfferButton';

const TOKEN = 'mQ8rZ3nUp2bX5yKdFgHjLs';
const ITEMS = [
  { name: 'Reckless Swing', pitch: 3, count: 3 },
  { name: 'Nullrune Hood', pitch: null, count: 1 },
];

function eventsPosted(api: IFakeApi): unknown[] {
  return api.calls.filter((call) => call.key === `POST /shared/decks/${TOKEN}/events`).map((call) => call.body);
}

describe('OfferButton', () => {
  let api: IFakeApi;
  let open: MockInstance<typeof window.open>;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set(`POST /shared/decks/${TOKEN}/events`, () => undefined);
    open = vi.spyOn(window, 'open').mockReturnValue(null);
    showToast.mockReset();
    // Installs the clipboard the copy path writes to.
    userEvent.setup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderButton(props: Partial<React.ComponentProps<typeof OfferButton>> = {}) {
    return renderWithProviders(
      <OfferButton
        token={TOKEN}
        sharerName="Caio"
        whatsapp="5551999990000"
        items={[ITEMS[0]!]}
        variant="single"
        label="Oferecer"
        ariaLabel="Oferecer Reckless Swing (Azul)"
        {...props}
      />,
      makeAuth({ user: null }),
    );
  }

  it('opens WhatsApp to the sharer or copies the offer', async () => {
    const first = renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Oferecer Reckless Swing (Azul)' }));

    expect(open).toHaveBeenCalledTimes(1);
    const sent = String(open.mock.calls[0]![0]);
    expect(sent.startsWith('https://wa.me/5551999990000?text=')).toBe(true);
    expect(decodeURIComponent(sent.split('?text=')[1]!)).toBe(
      'Oi Caio, vi seu pedido no Rathe Arsenal. Tenho 3 Reckless Swing (Azul), edição __, condição __, R$ __ cada.',
    );
    await waitFor(() => expect(eventsPosted(api)).toEqual([{ kind: 'offer' }]));
    first.unmount();

    // The combined button opens the message first, then sends the lines together.
    const second = renderButton({ items: ITEMS, variant: 'all', label: 'Oferecer as 2 cartas que você tem', ariaLabel: undefined });
    await userEvent.click(screen.getByRole('button', { name: 'Oferecer as 2 cartas que você tem' }));
    expect(screen.getByText('Oferecer para Caio')).toBeInTheDocument();
    expect(screen.getByText('Preencha edição, condição e preço no WhatsApp antes de enviar.')).toBeInTheDocument();
    open.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(decodeURIComponent(String(open.mock.calls[0]![0]).split('?text=')[1]!)).toBe(
      [
        'Oi Caio, vi seu pedido no Rathe Arsenal. Tenho:',
        '3 Reckless Swing (Azul), edição __, condição __, R$ __ cada',
        '1 Nullrune Hood, edição __, condição __, R$ __ cada',
      ].join('\n'),
    );
    await waitFor(() => expect(eventsPosted(api)).toHaveLength(2));
    second.unmount();

    // With no number on the link the same text goes to the clipboard.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    open.mockClear();
    renderButton({ whatsapp: null });
    await userEvent.click(screen.getByRole('button', { name: 'Oferecer Reckless Swing (Azul)' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Oi Caio, vi seu pedido no Rathe Arsenal. Tenho 3 Reckless Swing (Azul), edição __, condição __, R$ __ cada.',
      ),
    );
    expect(open).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', message: 'Texto copiado. Cole no grupo onde você viu o pedido.' }),
    );
    await waitFor(() => expect(eventsPosted(api)).toHaveLength(3));
  });

  it('still opens WhatsApp when recording the offer fails', async () => {
    api.handlers.set(`POST /shared/decks/${TOKEN}/events`, () => {
      throw new Error('offline');
    });
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: 'Oferecer Reckless Swing (Azul)' }));

    expect(open).toHaveBeenCalledTimes(1);
  });
});

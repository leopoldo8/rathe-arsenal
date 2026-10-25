import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createFakeApi,
  makeAuth,
  renderWithProviders,
  SIGNED_IN_USER,
  type IFakeApi,
} from '../../shared-deck/__tests__/sharingTestKit';
import type { IGroupAskCard } from '../groupAskMessage';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

import { GroupAskEditor } from '../GroupAskEditor';

const URL = 'https://rathe-arsenal.app/d/k7x2';

const CARDS: readonly IGroupAskCard[] = [
  { cardIdentifier: 'reckless-swing-blue', name: 'Reckless Swing', pitch: 3, quantity: 3, state: 'store_lacks', availableCopies: null },
  { cardIdentifier: 'crater-fist', name: 'Crater Fist', pitch: null, quantity: 1, state: 'not_on_site', availableCopies: null },
  { cardIdentifier: 'alpha-rampage-red', name: 'Alpha Rampage', pitch: 1, quantity: 2, state: 'priced', availableCopies: 2 },
];

function renderEditor(closingLine: string | null) {
  const setShareClosingLine = vi.fn();
  const auth = makeAuth({ user: { ...SIGNED_IN_USER, shareClosingLine: closingLine }, setShareClosingLine });
  renderWithProviders(<GroupAskEditor deckName="[CC] Brute do Caio" hero="Rhinar, Reckless Rampage" url={URL} cards={CARDS} />, auth);
  return { setShareClosingLine };
}

describe('GroupAskEditor', () => {
  let api: IFakeApi;
  let open: MockInstance<typeof window.open>;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set('PATCH /users/me/share-closing-line', ({ body }) => ({ text: (body as { text: string }).text }));
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefills the last closing line and saves it on send', async () => {
    const { setShareClosingLine } = renderEditor('Pago no PIX ou troco. Estou em Pelotas.');

    const field = screen.getByRole('textbox', { name: 'Linha final da mensagem' });
    expect(field).toHaveValue('Pago no PIX ou troco. Estou em Pelotas.');
    expect(screen.getByText('Da última vez · confira antes de enviar')).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, 'Só PIX. Estou em Rio Grande.');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    await waitFor(() => expect(api.calls.find((call) => call.key === 'PATCH /users/me/share-closing-line')?.body).toEqual({ text: 'Só PIX. Estou em Rio Grande.' }));
    await waitFor(() => expect(setShareClosingLine).toHaveBeenCalledWith('Só PIX. Estou em Rio Grande.'));
    expect(open).toHaveBeenCalledTimes(1);
    const opened = decodeURIComponent(String(open.mock.calls[0]![0]));
    expect(opened.startsWith('https://wa.me/?text=')).toBe(true);
    expect(opened).toContain('Procuro estas cartas para o meu deck [CC] Brute do Caio (Rhinar):');
    expect(opened).toContain('Só PIX. Estou em Rio Grande.');
    expect(opened).toContain(`Lista completa: ${URL}`);
  });

  it('starts empty with the example as placeholder when no line was sent before', async () => {
    renderEditor(null);

    const field = screen.getByRole('textbox', { name: 'Linha final da mensagem' });
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', 'Ex.: Pago no PIX ou troco. Estou em Pelotas.');
    expect(screen.queryByText('Da última vez · confira antes de enviar')).not.toBeInTheDocument();
  });

  it('shows the message, the switch with its counts and the button, in that order', () => {
    renderEditor(null);

    expect(screen.getByRole('heading', { name: 'Mensagem para o WhatsApp' })).toBeInTheDocument();
    expect(screen.getByText('Você pode editar antes de enviar.')).toBeInTheDocument();
    const message = screen.getByTestId('group-ask-message');
    expect(message).toHaveTextContent('3 Reckless Swing (Azul)');
    expect(message).toHaveTextContent('Também procuro: 1 Crater Fist.');
    expect(message).toHaveTextContent(`Lista completa: ${URL}`);
    const toggle = screen.getByRole('switch', { name: 'Incluir também as 2 que a loja tem' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Hoje a mensagem tem só as 4 que a loja não tem ou não achou.')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Abrir no WhatsApp' });
    expect(message.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds the store-side cards when the switch is turned on', async () => {
    renderEditor(null);

    await userEvent.click(screen.getByRole('switch', { name: /Incluir também/ }));

    expect(screen.getByTestId('group-ask-message')).toHaveTextContent('Na Cúpula DT tem, mas também aceito:');
    expect(screen.getByTestId('group-ask-message')).toHaveTextContent('2 Alpha Rampage (Vermelho)');
  });
});

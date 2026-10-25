import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi, makeAuth, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { DUDA, DUDA_MATCHES, TOKEN } from './visitorKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { SharedListPage } from '../SharedListPage';

const MESSAGE =
  'Oi Duda, vi sua lista no Rathe Arsenal. Quero: 1x Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45, 2x Snatch (Vermelho) · sem foil · R$ 6 cada. Total R$ 57.';

let api: IFakeApi;

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
  api.handlers.set(`GET /shared/lists/${TOKEN}`, () => DUDA);
  api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => DUDA_MATCHES);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function chooseAndOpenMessage(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());
  await screen.findByTestId('shared-list-buyer');
  await user.click(await screen.findByRole('button', { name: 'Mais uma cópia de Command and Conquer (Vermelho)' }));
  await user.click(screen.getByRole('button', { name: 'Mais uma cópia de Snatch (Vermelho)' }));
  await user.click(screen.getByRole('button', { name: 'Mais uma cópia de Snatch (Vermelho)' }));
  await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));
}

describe('the buy message', () => {
  it('Quero estas opens the editable buy message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());
    await screen.findByTestId('shared-list-buyer');

    await user.click(await screen.findByRole('button', { name: 'Mais uma cópia de Command and Conquer (Vermelho)' }));
    await user.click(screen.getByRole('button', { name: 'Mais uma cópia de Snatch (Vermelho)' }));
    await user.click(screen.getByRole('button', { name: 'Mais uma cópia de Snatch (Vermelho)' }));
    expect(within(screen.getByTestId('buyer-bar')).getByText('Quero estas · R$ 57')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));

    expect(screen.getByRole('button', { name: '‹ Lista de Duda' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mensagem para o WhatsApp' })).toBeInTheDocument();
    expect(screen.getByText('Você pode editar antes de enviar.')).toBeInTheDocument();
    const text = screen.getByRole('textbox', { name: 'Mensagem' });
    expect(text).toHaveValue(MESSAGE);
    expect(screen.getByRole('button', { name: 'Enviar no WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar texto' })).toBeInTheDocument();

    await user.type(text, ' Retiro no sábado.');
    expect(text).toHaveValue(`${MESSAGE} Retiro no sábado.`);
    await user.click(screen.getByRole('button', { name: '‹ Lista de Duda' }));
    expect(screen.getByTestId('shared-list-buyer')).toBeInTheDocument();
  });

  it('opens the sharer chat with the text when the link shows a number', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await chooseAndOpenMessage(user);

    await user.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    expect(open).toHaveBeenCalledWith(`https://wa.me/5553999990000?text=${encodeURIComponent(MESSAGE)}`, '_blank', 'noopener,noreferrer');
  });

  it('with no number the text is copied with the hint', async () => {
    const user = userEvent.setup();
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...DUDA, contactWhatsapp: null }));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await chooseAndOpenMessage(user);

    await user.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MESSAGE));
    expect(await screen.findByText('Texto copiado. Cole no grupo onde você viu a lista.')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('Copiar texto copies the text and says so', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await chooseAndOpenMessage(user);

    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MESSAGE));
    expect(await screen.findByText('Texto copiado.')).toBeInTheDocument();
  });
});

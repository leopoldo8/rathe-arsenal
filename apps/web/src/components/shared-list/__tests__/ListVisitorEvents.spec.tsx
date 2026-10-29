import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi, makeAuth, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { DUDA, DUDA_MATCHES, MARCOS, TOKEN } from './visitorKit';

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

let api: IFakeApi;

const eventsPosted = (): unknown[] => api.calls.filter((call) => call.key === `POST /shared/lists/${TOKEN}/events`).map((call) => call.body);

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
  api.handlers.set(`GET /shared/lists/${TOKEN}`, () => DUDA);
  api.handlers.set(`GET /shared/lists/${TOKEN}/matches`, () => DUDA_MATCHES);
  api.handlers.set(`POST /shared/lists/${TOKEN}/events`, () => undefined);
  vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what the sharer of a list is told', () => {
  it('sending the buy message and copying it each record a buy, and only then', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());
    await screen.findByTestId('shared-list-buyer');
    await user.click(await screen.findByRole('button', { name: 'Mais uma cópia de Snatch (Vermelho)' }));
    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));
    expect(eventsPosted()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
    await user.click(screen.getByRole('button', { name: 'Copiar texto' }));

    await waitFor(() => expect(eventsPosted()).toEqual([{ kind: 'buy' }, { kind: 'buy' }]));
  });

  it('sending the offer message of a want list records an offer, and a failed post stops nothing', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => MARCOS);
    api.handlers.set(`POST /shared/lists/${TOKEN}/events`, () => {
      throw new Error('offline');
    });
    renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());
    await screen.findByTestId('shared-list-trade');
    await user.click(await screen.findByRole('button', { name: 'Mais uma cópia de Pummel (Vermelho)' }));
    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));

    await user.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    await waitFor(() => expect(eventsPosted()).toEqual([{ kind: 'offer' }]));
    expect(window.open).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi, makeAuth, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { MARCOS, TOKEN } from './visitorKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient:
    () =>
    <T,>(path: string, init?: RequestInit): Promise<T> =>
      apiRef.current!.authFetch(path, init) as Promise<T>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

import { SharedListPage } from '../SharedListPage';

const OFFER_WITH_MINE =
  'Oi Marcos, vi sua lista no Rathe Arsenal. Tenho sobrando para você: 3x Pummel (Vermelho) · sem foil, 1x Command and Conquer (Vermelho). Em troca procuro: 2x Wrecker Romp (Azul), 1x Savage Feast (Vermelho). Minha lista: https://rathearsenal.app/l/p3Rv8n';
const OFFER_ONLY =
  'Oi Marcos, vi sua lista no Rathe Arsenal. Tenho sobrando para você: 3x Pummel (Vermelho) · sem foil, 1x Command and Conquer (Vermelho).';

let api: IFakeApi;

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
  api.handlers.set(`GET /shared/lists/${TOKEN}`, () => MARCOS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function chooseOffer(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());
  const view = await screen.findByTestId('shared-list-trade');
  for (let copy = 0; copy < 3; copy += 1) {
    await user.click(await screen.findByRole('button', { name: 'Mais uma cópia de Pummel (Vermelho)' }));
  }
  await user.click(screen.getByRole('button', { name: 'Mais uma cópia de Command and Conquer (Vermelho)' }));
  return view;
}

describe('the trade view', () => {
  it('a friend sees what they can spare, with the reason when none', async () => {
    renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());

    const view = await screen.findByTestId('shared-list-trade');
    expect(within(view).getByText('Procuro - Kayo')).toBeInTheDocument();
    expect(within(view).getByRole('heading', { level: 1, name: 'Cartas que Marcos procura' })).toBeInTheDocument();
    expect(within(view).getByText('Você tem sobrando 4 cópias de 2 cartas que Marcos procura.')).toBeInTheDocument();
    const rows = within(view).getAllByTestId('trade-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Marcos procura 3 · sugerido R$ 4')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Você tem 4 · 3 sobrando')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Marcos procura 1 · sugerido R$ 45')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Você tem 2 · 1 sobrando')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Você tem 2 · nenhuma sobrando (o seu Rhinar SA usa as 2)')).toBeInTheDocument();
    expect(within(rows[2]!).queryByRole('button')).not.toBeInTheDocument();
    expect(within(view).getByText('2 cartas que você não tem: Pack Hunt (Azul), Bloodrush Bellow (Amarelo)')).toBeInTheDocument();
    const mine = within(view).getByRole('switch', { name: /Incluir minha lista/ });
    expect(mine).not.toBeChecked();
    expect(within(view).getByText('Procuro - Rhinar (3 cópias)')).toBeInTheDocument();
    for (const row of rows.slice(0, 2)) expect(row.querySelector('output')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Ver mensagem' })).toBeDisabled();
  });

  it('asks the rule question before any spare number when it is owed', async () => {
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({
      ...MARCOS,
      spareNeedsRule: true,
      lines: MARCOS.lines.map((line) => ({ ...line, spare: null })),
    }));
    api.handlers.set('GET /collection/spare', () => ({
      needsRule: true,
      rule: null,
      counts: { within_format: 20, any_deck: 24, per_deck: 19 },
      totalSpare: 0,
      rows: [],
      why: {},
      ideaDecks: [],
    }));
    renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());

    expect(await screen.findByText('Você passa cartas de um deck para outro?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.queryByTestId('trade-row')).not.toBeInTheDocument();
    expect(screen.queryByText(/sobrando/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver mensagem' })).not.toBeInTheDocument();
  });

  it("the value of each side shows on screen and never in the message", async () => {
    const user = userEvent.setup();
    const view = await chooseOffer(user);

    expect(within(view).queryByTestId('trade-value')).not.toBeInTheDocument();
    await user.click(within(view).getByRole('switch', { name: /Incluir minha lista/ }));
    expect(within(view).getByTestId('trade-value')).toHaveTextContent('Valor aproximado, pelo preço sugerido: você oferece R$ 57 · você procura R$ 21');

    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));
    expect(screen.getByRole('textbox', { name: 'Mensagem' }).textContent ?? '').not.toContain('R$');
    expect((screen.getByRole('textbox', { name: 'Mensagem' }) as HTMLTextAreaElement).value).not.toContain('R$');

    await user.click(screen.getByRole('button', { name: '‹ Lista do Marcos' }));
    await user.click(screen.getByRole('switch', { name: /Incluir minha lista/ }));
    expect(screen.queryByTestId('trade-value')).not.toBeInTheDocument();
  });

  it("builds the offer message with and without the visitor's list", async () => {
    const user = userEvent.setup();
    const view = await chooseOffer(user);

    await user.click(within(view).getByRole('switch', { name: /Incluir minha lista/ }));
    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));
    expect(screen.getByRole('button', { name: '‹ Lista do Marcos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mensagem para o WhatsApp' })).toBeInTheDocument();
    expect(screen.getByText('Você pode editar antes de enviar.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveValue(OFFER_WITH_MINE);
    expect(screen.getByRole('button', { name: 'Enviar no WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar texto' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '‹ Lista do Marcos' }));
    await user.click(screen.getByRole('switch', { name: /Incluir minha lista/ }));
    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));
    expect(screen.getByRole('textbox', { name: 'Mensagem' })).toHaveValue(OFFER_ONLY);
  });

  it('with no number the offer is copied with the hint', async () => {
    const user = userEvent.setup();
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...MARCOS, contactWhatsapp: null }));
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await chooseOffer(user);
    await user.click(screen.getByRole('button', { name: 'Ver mensagem' }));

    await user.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(OFFER_ONLY));
    expect(await screen.findByText('Texto copiado. Cole no grupo onde você viu a lista.')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('shows no switch when the visitor has no list of their own to ask for', async () => {
    api.handlers.set(`GET /shared/lists/${TOKEN}`, () => ({ ...MARCOS, visitorList: null }));
    renderWithProviders(<SharedListPage token={TOKEN} />, makeAuth());

    await screen.findByTestId('shared-list-trade');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});

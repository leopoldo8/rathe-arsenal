/**
 * The one-field start (`/` and `/entrar`): the pitch, the typo check, the shared-page variant, and
 * the pages that no longer exist. Screens `r3-arrive-phone`, `r2-typo-phone`, `r2-share-renata-phone`
 * of `.design/account.md`.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { writeShareReturn } from '../../lib/share-return';
import { jsonResponse, makeAuth, renderWithAuth, stubViewport } from '../../components/auth/__tests__/accountTestKit';

const searchRef = vi.hoisted(() => ({ current: {} as { token?: string } }));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => searchRef.current }),
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { push: vi.fn() } }),
  redirect: vi.fn(),
}));
vi.mock('../../components/ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import { EntrarPage } from '../entrar';
import { ptBR } from '../../i18n/locales/pt-BR';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  searchRef.current = {};
  localStorage.clear();
  stubViewport(true);
  fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 404));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const startRequests = (): unknown[] => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/auth/'));

describe('the one-field start', () => {
  it('the start page shows the pitch, one field and what comes next', () => {
    renderWithAuth(<EntrarPage />);

    const inOrder = [
      screen.getAllByText('Rathe Arsenal')[0]!,
      screen.getByText('Monte seus decks de Flesh and Blood, veja quais cartas você já tem e quanto custa o que falta.'),
      screen.getByText('Confere se o deck pode jogar no torneio'),
      screen.getByText('Lista o que falta, com o preço na loja'),
      screen.getByText('Manda a lista pronta no WhatsApp'),
      screen.getByLabelText('Seu e-mail'),
      screen.getByRole('button', { name: 'Continuar' }),
      screen.getByText(
        'Se for sua primeira vez, a conta é criada na hora. Se você já tem conta, pedimos a senha ou mandamos um código.',
      ),
      screen.getByText(ptBR.about.disclaimer),
      screen.getByRole('link', { name: 'Sobre' }),
    ];
    for (let i = 1; i < inOrder.length; i++) {
      expect(inOrder[i - 1]!.compareDocumentPosition(inOrder[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByLabelText('Seu e-mail')).toHaveValue('');
    expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute('href', '/about');
  });

  it('starts with the address this device remembers', () => {
    localStorage.setItem('ra.lastEmail', 'lucas.prado@hotmail.com');

    renderWithAuth(<EntrarPage />);

    expect(screen.getByLabelText('Seu e-mail')).toHaveValue('lucas.prado@hotmail.com');
  });

  it('a malformed address is caught on the page and nothing is sent', async () => {
    renderWithAuth(<EntrarPage />);
    const field = screen.getByLabelText('Seu e-mail');

    await userEvent.type(field, 'bia@gmail');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText('Falta o final do e-mail, por exemplo bia@gmail.com')).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Nada foi enviado ainda.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the API what a typed address takes next and moves to that step', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url) === '/api/auth/start' ? jsonResponse({ next: 'new' }) : jsonResponse({}, 404),
    );
    renderWithAuth(<EntrarPage />);

    await userEvent.type(screen.getByLabelText('Seu e-mail'), ' Bia.Souza@Gmail.com ');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Criar sua conta' })).toBeInTheDocument();
    const [, init] = startRequests()[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ email: 'bia.souza@gmail.com' });
  });

  it('"Errei o e-mail" returns to the field with the address in it', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url) === '/api/auth/start' ? jsonResponse({ next: 'new' }) : jsonResponse({}, 404),
    );
    renderWithAuth(<EntrarPage />);
    await userEvent.type(screen.getByLabelText('Seu e-mail'), 'bia.souza@gmail.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Errei o e-mail' }));

    expect(screen.getByLabelText('Seu e-mail')).toHaveValue('bia.souza@gmail.com');
  });

  it('from a shared page the card and the reason replace the pitch', async () => {
    writeShareReturn('abc123', 'd');
    fetchMock.mockImplementation(async (url: string) =>
      String(url).startsWith('/api/shared/decks/abc123')
        ? jsonResponse({ intent: 'deck', name: 'Rhinar - Blitz', sharerName: 'Bia', heroCard: null })
        : jsonResponse({}, 404),
    );

    renderWithAuth(<EntrarPage />);

    expect(await screen.findByText('Rhinar - Blitz · por Bia')).toBeInTheDocument();
    expect(screen.getByText('Crie a conta para comparar o deck da Bia com as suas cartas.')).toBeInTheDocument();
    expect(screen.getByLabelText('Seu e-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    expect(screen.getByText('Depois, você volta para o deck da Bia.')).toBeInTheDocument();
    expect(screen.queryByText(/Monte seus decks/)).not.toBeInTheDocument();
    expect(screen.queryByText('Confere se o deck pode jogar no torneio')).not.toBeInTheDocument();
  });

  it('a missing-cards link asks to see which of the cards the visitor owns', async () => {
    writeShareReturn('abc123', 'd');
    fetchMock.mockImplementation(async (url: string) =>
      String(url).startsWith('/api/shared/decks/abc123')
        ? jsonResponse({ intent: 'missing', name: 'Rhinar - Blitz', sharerName: 'Bia', heroCard: null })
        : jsonResponse({}, 404),
    );

    renderWithAuth(<EntrarPage />);

    expect(await screen.findByText('Crie a conta para ver quais destas cartas você já tem.')).toBeInTheDocument();
  });

  it('a shared list says it will bring the visitor back to the list', async () => {
    writeShareReturn('xyz789', 'l');
    fetchMock.mockImplementation(async (url: string) =>
      String(url).startsWith('/api/shared/lists/xyz789')
        ? jsonResponse({ kind: 'want', name: 'Quero estas', sharerName: 'Pedro' })
        : jsonResponse({}, 404),
    );

    renderWithAuth(<EntrarPage />);

    expect(await screen.findByText('Depois, você volta para a lista do Pedro.')).toBeInTheDocument();
  });

  it('a dead shared link falls back to the pitch', async () => {
    writeShareReturn('dead00', 'd');

    renderWithAuth(<EntrarPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/Depois, você volta/)).not.toBeInTheDocument();
  });

  it('an e-mailed button signs in on arrival, once', async () => {
    const token = 'a'.repeat(64);
    const redeemCode = vi.fn().mockResolvedValue({ returnPath: null });
    searchRef.current = { token };

    renderWithAuth(<EntrarPage />, makeAuth({ redeemCode }));

    await waitFor(() => expect(redeemCode).toHaveBeenCalledWith(token));
    expect(redeemCode).toHaveBeenCalledTimes(1);
  });

  it('an e-mailed button that no longer works leaves the plain start page', async () => {
    searchRef.current = { token: 'b'.repeat(64) };
    const redeemCode = vi.fn().mockRejectedValue(new Error('401'));

    renderWithAuth(<EntrarPage />, makeAuth({ redeemCode }));

    expect(await screen.findByLabelText('Seu e-mail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a visitor whose session this device restored goes to the home, not to the start', () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'user' as const, chatAccess: false };

    renderWithAuth(<EntrarPage />, makeAuth({ user, restoredSession: true }));

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/home');
  });

  it('a sign-in made on this page is left to the flow to finish', () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'user' as const, chatAccess: false };

    renderWithAuth(<EntrarPage />, makeAuth({ user }));

    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Seu e-mail')).toBeInTheDocument();
  });
});

describe('the pages that no longer exist', () => {
  const SRC = path.resolve(__dirname, '../..');

  it('the reset pages are not routes', () => {
    const routeTree = fs.readFileSync(path.join(SRC, 'routeTree.gen.ts'), 'utf-8');

    for (const page of ['forgot-password', 'reset-password']) {
      expect(fs.existsSync(path.join(SRC, 'routes', `${page}.tsx`))).toBe(false);
      expect(routeTree).not.toContain(`/${page}`);
    }
    expect(routeTree).toContain("'/entrar'");
  });
});

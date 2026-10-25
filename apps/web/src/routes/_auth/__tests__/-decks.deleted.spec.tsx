import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IDeletedDeck } from '../../../api/deleted-decks';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => apiFetch };
});
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (config: object) => ({ ...config }),
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

import { DeletedDecksPage } from '../decks.deleted';

const DAY_MS = 24 * 60 * 60 * 1000;

function deletedDeck(overrides: Partial<IDeletedDeck> = {}): IDeletedDeck {
  const now = Date.now();
  return {
    id: 7,
    name: 'Rhinar Blitz v2',
    status: 'idea',
    format: 'Blitz',
    totalCards: 12,
    deletedAt: new Date(now).toISOString(),
    purgeAt: new Date(now + 30 * DAY_MS).toISOString(),
    ...overrides,
  };
}

function renderPage(decks: readonly IDeletedDeck[]) {
  apiFetch.mockImplementation(async (path: string) => (path === '/decks/deleted' ? { decks } : {}));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeletedDecksPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
});

describe('Deleted decks page', () => {
  it('matches r2-deleted-list-phone', async () => {
    renderPage([deletedDeck()]);

    const deck = await screen.findByTestId('deleted-deck');
    const ordered = [
      screen.getByText('‹ Meus decks'),
      screen.getByRole('heading', { level: 1, name: 'Excluídos recentemente' }),
      screen.getByText('Um deck excluído volta com as cartas, as substituições e o histórico.'),
      within(deck).getByRole('heading', { name: 'Rhinar Blitz v2' }),
      within(deck).getByText('Ideia · 12 cartas · excluído hoje · some de vez em 30 dias'),
      within(deck).getByRole('button', { name: 'Restaurar Rhinar Blitz v2' }),
      within(deck).getByRole('button', { name: 'Excluir de vez Rhinar Blitz v2' }),
    ];
    ordered.slice(1).forEach((node, index) => {
      expect(ordered[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(within(deck).getByRole('button', { name: /Restaurar/ })).toHaveTextContent('Restaurar');
    expect(within(deck).getByRole('button', { name: /de vez/ })).toHaveTextContent('Excluir de vez');
  });

  it('says when it was deleted and how long is left', async () => {
    const now = Date.now();
    renderPage([
      deletedDeck({ id: 1, name: 'Ontem', deletedAt: new Date(now - DAY_MS - 1000).toISOString(), purgeAt: new Date(now + 29 * DAY_MS - 1000).toISOString() }),
      deletedDeck({ id: 2, name: 'Quase', status: 'ready', totalCards: 1, deletedAt: new Date(now - 29 * DAY_MS - 1000).toISOString(), purgeAt: new Date(now + DAY_MS - 1000).toISOString() }),
    ]);

    expect(await screen.findByText('Ideia · 12 cartas · excluído ontem · some de vez em 29 dias')).toBeInTheDocument();
    expect(screen.getByText('Pronto · 1 carta · excluído há 29 dias · some de vez em 1 dia')).toBeInTheDocument();
  });

  it('restaurar calls the restore route', async () => {
    const user = userEvent.setup();
    renderPage([deletedDeck()]);

    await user.click(await screen.findByRole('button', { name: 'Restaurar Rhinar Blitz v2' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/decks/7/restore', { method: 'POST' }));
  });

  it('excluir de vez asks once', async () => {
    const user = userEvent.setup();
    renderPage([deletedDeck()]);
    const permanentCalls = (): number =>
      apiFetch.mock.calls.filter(([path]) => String(path).endsWith('/permanent')).length;

    await user.click(await screen.findByRole('button', { name: 'Excluir de vez Rhinar Blitz v2' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Excluir "Rhinar Blitz v2" de vez?');
    await user.click(within(dialog).getByRole('button', { name: 'Manter' }));
    expect(permanentCalls()).toBe(0);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Excluir de vez Rhinar Blitz v2' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir de vez' }));

    await waitFor(() => expect(permanentCalls()).toBe(1));
    expect(apiFetch).toHaveBeenCalledWith('/decks/7/permanent', { method: 'DELETE' });
  });

  it('says so when there is nothing deleted', async () => {
    renderPage([]);

    expect(await screen.findByText('Nenhum deck excluído.')).toBeInTheDocument();
  });
});

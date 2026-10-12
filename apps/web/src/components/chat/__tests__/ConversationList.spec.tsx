import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('./chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('./chat-test-mocks')).routerMock);

import {
  callsTo,
  conversation,
  deck,
  decksResponse,
  mockApiFetch,
  mockNavigate,
  navigatedTo,
  NOT_AT_CAP,
  renderWithClient,
  serveApi,
  summary,
} from './chat-test-utils';
import type { IChatConversationSummary } from '../../../api/chat';
import { ChatScreen } from '../ChatScreen';

const KATSU = deck({ id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer' });
const THREE: IChatConversationSummary[] = [
  summary({ id: 'c-old', title: 'Regra de gatilhos', updatedAt: '2026-10-01T10:00:00.000Z' }),
  summary({ id: 'c-1', title: 'Katsu nos torneios', trackedDeckId: 7, updatedAt: '2026-10-11T09:00:00.000Z' }),
  summary({ id: 'c-2', title: null, updatedAt: '2026-10-05T10:00:00.000Z' }),
];

function serveList(conversations: IChatConversationSummary[], extra: Record<string, (body: unknown) => unknown> = {}): void {
  let listed = conversations;
  serveApi({
    'GET /chat/conversations': () => listed,
    'GET /chat/usage': () => NOT_AT_CAP,
    'GET /decks': () => decksResponse([KATSU]),
    'GET /chat/conversations/c-1': () => conversation({ id: 'c-1', trackedDeckId: 7 }),
    'DELETE /chat/conversations/c-2': () => {
      listed = listed.filter((row) => row.id !== 'c-2');
      return undefined;
    },
    'DELETE /chat/conversations/c-1': () => {
      listed = listed.filter((row) => row.id !== 'c-1');
      return undefined;
    },
    ...extra,
  });
}

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Conversas/ }));
  return screen.findByRole('dialog', { name: 'Conversas' });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockNavigate.mockReset();
});

describe('Conversation list', () => {
  it('the header opens the list and starts a new one', async () => {
    serveList(THREE);

    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);

    const button = await screen.findByRole('button', { name: /^Conversas/ });
    await waitFor(() => expect(within(button).getByTestId('conversation-count').textContent).toBe('3'));
    expect(screen.getByRole('link', { name: 'Nova' })).toHaveAttribute('href', '/chat');
  });

  it('the list orders, marks and opens conversations', async () => {
    const user = userEvent.setup();
    serveList(THREE);
    const view = renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);

    const list = await openList(user);

    const rows = within(list).getAllByTestId('conversation-row');
    expect(rows.map((row) => within(row).getByTestId('conversation-title').textContent)).toEqual(['Katsu nos torneios', 'Nova conversa', 'Regra de gatilhos']);
    expect(rows.map((row) => within(row).queryByTestId('deck-chip')?.textContent ?? null)).toEqual(['Katsu CC', null, null]);
    expect(rows.every((row) => within(row).getByTestId('conversation-time').textContent !== '')).toBe(true);
    expect(rows.map((row) => within(row).getByTestId('conversation-open').getAttribute('aria-current'))).toEqual(['true', null, null]);

    await user.click(within(rows[2]!).getByTestId('conversation-open'));
    expect(navigatedTo()).toBe('/chat/c-old');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conversas' })).toBeNull());
    view.unmount();

    serveList([]);
    renderWithClient(<ChatScreen conversationId={null} draftDeckId={null} />);
    const empty = await openList(user);
    expect(within(empty).getByText('Nenhuma conversa ainda.')).toBeInTheDocument();
  });

  it('deleting asks first and leaves the list', async () => {
    const user = userEvent.setup();
    serveList(THREE);
    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);
    let list = await openList(user);

    await user.click(within(list).getByRole('button', { name: 'Apagar a conversa Nova conversa' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Apagar esta conversa?' });
    expect(within(confirm).getByText('As mensagens e as propostas somem. O que você já aplicou continua nos seus decks.')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(callsTo('DELETE /chat/conversations/c-2')).toHaveLength(0);

    await user.click(within(list).getByRole('button', { name: 'Apagar a conversa Nova conversa' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(callsTo('DELETE /chat/conversations/c-2')).toHaveLength(1));
    await waitFor(() => expect(within(list).getAllByTestId('conversation-row')).toHaveLength(2));
    expect(mockNavigate).not.toHaveBeenCalled();

    list = screen.getByRole('dialog', { name: 'Conversas' });
    await user.click(within(list).getByRole('button', { name: 'Apagar a conversa Katsu nos torneios' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(navigatedTo()).toBe('/chat'));
  });
});

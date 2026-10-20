import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  message,
  mockApiFetch,
  mockNavigate,
  navigatedTo,
  NOT_AT_CAP,
  renderWithClient,
  serveApi,
  summary,
  swapProposal,
} from './chat-test-utils';
import type { IChatConversationSummary } from '../../../api/chat';
import { ChatScreen } from '../ChatScreen';

const KATSU = deck({ id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer' });
const NOW = new Date('2026-10-11T12:00:00.000Z');
const CONVERSATIONS: IChatConversationSummary[] = [
  summary({ id: 'c-old', title: 'Regra de gatilhos', updatedAt: '2026-09-20T10:00:00.000Z' }),
  summary({ id: 'c-1', title: 'Katsu nos torneios', trackedDeckId: 7, updatedAt: '2026-10-11T09:00:00.000Z' }),
  summary({ id: 'c-2', title: 'Próximo herói', updatedAt: '2026-10-08T10:00:00.000Z' }),
];
const OPEN = conversation({
  id: 'c-1',
  trackedDeckId: 7,
  messages: [
    message({ id: 'm-1', role: 'user', text: 'Como jogam o Katsu?' }),
    message({ id: 'm-2', role: 'assistant', text: 'Assim.', proposals: [swapProposal({ id: 'p-1' }), swapProposal({ id: 'p-2' })] }),
    message({ id: 'm-3', role: 'user', text: 'E a troca?' }),
    message({ id: 'm-4', role: 'assistant', text: 'Esta.' }),
  ],
});

function wideScreen(wide: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: wide && query === '(min-width: 960px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function serve(conversations: IChatConversationSummary[] = CONVERSATIONS): void {
  let listed = conversations;
  serveApi({
    'GET /chat/conversations': () => listed,
    'GET /chat/usage': () => NOT_AT_CAP,
    'GET /decks': () => decksResponse([KATSU]),
    'GET /chat/conversations/c-1': () => OPEN,
    'DELETE /chat/conversations/c-2': () => {
      listed = listed.filter((row) => row.id !== 'c-2');
      return undefined;
    },
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockNavigate.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('ChatScreen on a wide screen', () => {
  it('keeps a new conversation link, the open conversation and the conversations by date on the left', async () => {
    wideScreen(true);
    serve();

    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);

    const sidebar = await screen.findByRole('complementary', { name: 'Conversas' });
    expect(within(sidebar).getByRole('link', { name: 'Nova conversa' })).toHaveAttribute('href', '/chat');
    const open = within(sidebar).getByTestId('open-conversation');
    await waitFor(() => expect(within(open).getByText('Katsu nos torneios')).toBeInTheDocument());
    expect(within(open).getByTestId('deck-chip').textContent).toBe('Katsu CC');
    expect(within(open).getByText('2 perguntas · 2 propostas')).toBeInTheDocument();
    await waitFor(() => expect(within(sidebar).getAllByTestId('conversation-row')).toHaveLength(3));
    const groups = within(sidebar).getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(['Hoje', 'Esta semana', 'Mais antigas']);
    expect(groups.map((group) => within(group).getAllByTestId('conversation-title').map((title) => title.textContent))).toEqual([
      ['Katsu nos torneios'],
      ['Próximo herói'],
      ['Regra de gatilhos'],
    ]);
    expect(screen.queryByRole('button', { name: /^Conversas/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens and deletes conversations from the left list without a dialog', async () => {
    const user = userEvent.setup();
    wideScreen(true);
    serve();
    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);
    const sidebar = await screen.findByRole('complementary', { name: 'Conversas' });
    await waitFor(() => expect(within(sidebar).getAllByTestId('conversation-row')).toHaveLength(3));

    await user.click(within(sidebar).getByRole('button', { name: 'Apagar a conversa Próximo herói' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(callsTo('DELETE /chat/conversations/c-2')).toHaveLength(1));
    await waitFor(() => expect(within(sidebar).getAllByTestId('conversation-row')).toHaveLength(2));

    await user.click(within(sidebar).getAllByTestId('conversation-open')[1]!);
    expect(navigatedTo()).toBe('/chat/c-old');
  });

  it('a new conversation shows its draft deck in the open conversation block', async () => {
    wideScreen(true);
    serve([]);

    renderWithClient(<ChatScreen conversationId={null} draftDeckId={7} />);

    const open = await screen.findByTestId('open-conversation');
    expect(within(open).getByText('Nova conversa')).toBeInTheDocument();
    await waitFor(() => expect(within(open).getByTestId('deck-chip').textContent).toBe('Katsu CC'));
    expect(within(open).queryByText(/perguntas/)).toBeNull();
    expect(within(screen.getByRole('complementary', { name: 'Conversas' })).getByText('Nenhuma conversa ainda.')).toBeInTheDocument();
  });

  it('scrolls the conversation, not the page, to the latest message', async () => {
    wideScreen(true);
    serve();
    const scrolled: number[] = [];
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 900 });
    const setter = vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set').mockImplementation(function (this: HTMLElement, value: number) {
      if (this.dataset['testid'] === 'chat-scroller') scrolled.push(value);
    });

    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);

    await waitFor(() => expect(scrolled).toContain(900));
    setter.mockRestore();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  });
});

describe('ChatScreen on a narrow screen', () => {
  it('keeps the conversations behind the header button', async () => {
    wideScreen(false);
    serve();

    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);

    expect(await screen.findByRole('button', { name: /^Conversas/ })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Conversas' })).toBeNull();
  });
});

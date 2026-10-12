import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('./chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('./chat-test-mocks')).routerMock);

import {
  apiError,
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
} from './chat-test-utils';
import { ChatScreen } from '../ChatScreen';

const KATSU = deck({ id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer', updatedAt: '2026-10-10T00:00:00.000Z' });
const OSCILIO = deck({ id: 9, name: 'Oscilio Blitz', hero: 'Oscilio', updatedAt: '2026-09-01T00:00:00.000Z' });

function serveNew(overrides: Record<string, (body: unknown) => unknown> = {}): void {
  serveApi({
    'GET /chat/conversations': () => [],
    'GET /chat/usage': () => NOT_AT_CAP,
    'GET /decks': () => decksResponse([OSCILIO, KATSU]),
    'POST /chat/conversations': () => ({ id: 'c-1' }),
    'POST /chat/conversations/c-1/messages': () => ({ userMessageId: 'm-1', assistantMessageId: 'm-2' }),
    'GET /chat/conversations/c-1': () => conversation(),
    ...overrides,
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockNavigate.mockReset();
});

describe('ChatScreen on /chat', () => {
  it('the empty state invites a first question', async () => {
    serveNew();

    renderWithClient(<ChatScreen conversationId={null} draftDeckId={null} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Nova conversa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pergunte sobre seus decks e o meta' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'O Tutor busca nos seus decks, na sua coleção, em decks de torneio com colocação e nas regras completas. Quando sugere mudanças, você decide se aplica.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensagem para o Tutor' })).toHaveAttribute('placeholder', 'Pergunte ao Tutor');
    expect(screen.getAllByTestId('tutor-mark').length).toBeGreaterThan(0);
  });

  it('ready questions follow the latest deck', async () => {
    serveNew();
    const withDecks = renderWithClient(<ChatScreen conversationId={null} draftDeckId={null} />);
    await waitFor(() => expect(screen.getAllByTestId('ready-question')).toHaveLength(3));
    expect(screen.getAllByTestId('ready-question').map((button) => button.textContent)).toEqual([
      'Como outras pessoas montam o Katsu, the Wanderer nos torneios?',
      'Qual herói devo montar a seguir com as cartas que tenho?',
      'Explique a ordem dos gatilhos ao atacar',
    ]);
    withDecks.unmount();

    serveNew({ 'GET /decks': () => decksResponse([]) });
    renderWithClient(<ChatScreen conversationId={null} draftDeckId={null} />);
    await waitFor(() => expect(callsTo('GET /decks')).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getAllByTestId('ready-question').map((button) => button.textContent)).toEqual([
        'Qual herói devo montar a seguir com as cartas que tenho?',
        'Explique a ordem dos gatilhos ao atacar',
      ]),
    );
  });

  it('the first send creates the conversation then posts', async () => {
    const user = userEvent.setup();
    serveNew();
    const unbound = renderWithClient(<ChatScreen conversationId={null} draftDeckId={null} />);

    await user.click(screen.getByRole('button', { name: 'Explique a ordem dos gatilhos ao atacar' }));

    await waitFor(() => expect(navigatedTo()).toBe('/chat/c-1'));
    expect(mockApiFetch.mock.calls.map(([path, init]) => `${(init as RequestInit | undefined)?.method ?? 'GET'} ${path}`).filter((key) => key.startsWith('POST'))).toEqual([
      'POST /chat/conversations',
      'POST /chat/conversations/c-1/messages',
    ]);
    expect(callsTo('POST /chat/conversations')).toEqual([{}]);
    expect(callsTo('POST /chat/conversations/c-1/messages')).toEqual([{ text: 'Explique a ordem dos gatilhos ao atacar' }]);
    unbound.unmount();

    mockApiFetch.mockClear();
    renderWithClient(<ChatScreen conversationId={null} draftDeckId={7} />);
    await user.type(screen.getByRole('textbox', { name: 'Mensagem para o Tutor' }), 'Como melhorar?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(callsTo('POST /chat/conversations')).toEqual([{ trackedDeckId: 7 }]));
    expect(callsTo('POST /chat/conversations/c-1/messages')).toEqual([{ text: 'Como melhorar?' }]);
  });

  it('a deck draft shows its chip', async () => {
    serveNew();

    renderWithClient(<ChatScreen conversationId={null} draftDeckId={7} />);

    const chip = await screen.findByRole('link', { name: 'Katsu CC' });
    expect(chip).toHaveAttribute('href', '/decks/7');
  });

  it('a failed first post keeps the text', async () => {
    const user = userEvent.setup();
    serveNew({
      'POST /chat/conversations/c-1/messages': () => {
        throw apiError(409, 'CHAT_TURN_IN_PROGRESS');
      },
    });
    const first = renderWithClient(<ChatScreen conversationId={null} draftDeckId={null} />);
    await user.type(screen.getByRole('textbox', { name: 'Mensagem para o Tutor' }), 'Minha pergunta');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(navigatedTo()).toBe('/chat/c-1'));
    first.unmount();

    renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);

    expect(await screen.findByRole('textbox', { name: 'Mensagem para o Tutor' })).toHaveValue('Minha pergunta');
    expect(screen.getByText('Ainda há uma resposta a caminho nesta conversa.')).toBeInTheDocument();
  });
});

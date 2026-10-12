import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setTestLocale } from '../../../test/i18n-test-utils';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('./chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('./chat-test-mocks')).routerMock);

import {
  apiError,
  AT_CAP,
  callsTo,
  conversation,
  deck,
  decksResponse,
  message,
  mockApiFetch,
  NOT_AT_CAP,
  renderWithClient,
  serveApi,
} from './chat-test-utils';
import type { IChatConversation, IChatUsage } from '../../../api/chat';
import { ChatScreen } from '../ChatScreen';

const KATSU = deck({ id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer' });
const QUESTION = message({ id: 'm-1', role: 'user', text: 'Como o pessoal monta o Katsu?', createdAt: '2026-10-11T10:00:00.000Z' });

function serveThread(read: () => IChatConversation, usage: IChatUsage = NOT_AT_CAP, extra: Record<string, (body: unknown) => unknown> = {}): void {
  serveApi({
    'GET /chat/conversations': () => [],
    'GET /chat/usage': () => usage,
    'GET /decks': () => decksResponse([KATSU]),
    'GET /chat/conversations/c-1': read,
    ...extra,
  });
}

function renderThread() {
  return renderWithClient(<ChatScreen conversationId="c-1" draftDeckId={null} />);
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

afterEach(async () => {
  vi.useRealTimers();
  await setTestLocale('pt-BR');
});

describe('ChatScreen thread', () => {
  it('messages read in order with the Tutor label', async () => {
    serveThread(() =>
      conversation({
        messages: [message({ id: 'm-2', role: 'assistant', text: 'Seis decks de Katsu.', createdAt: '2026-10-11T10:00:30.000Z' }), QUESTION],
      }),
    );

    renderThread();

    const user = await screen.findByText('Como o pessoal monta o Katsu?');
    const answer = await screen.findByText('Seis decks de Katsu.');
    const items = screen.getAllByTestId('chat-message');
    expect(items.map((item) => item.getAttribute('data-role'))).toEqual(['user', 'assistant']);
    expect(items[0]).toContainElement(user);
    expect(items[1]).toContainElement(answer);
    expect(within(items[1]!).getByTestId('answer-label').textContent).toMatch(/^tutor$/i);
    expect(within(items[1]!).getByTestId('answer-label').parentElement).toContainElement(within(items[1]!).getByTestId('tutor-mark'));
    expect(within(items[0]!).queryByTestId('answer-label')).toBeNull();
  });

  it('an open turn shows the wait', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-11T10:00:18.000Z') });
    for (const status of ['running', 'pending'] as const) {
      serveThread(() => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status, createdAt: '2026-10-11T10:00:00.000Z' })] }));
      const view = renderThread();

      expect(await screen.findByText('Buscando')).toBeInTheDocument();
      expect(screen.getByText('há 18 s')).toBeInTheDocument();
      expect(screen.getByText('Costuma levar de 20 a 40 segundos. Pode sair desta tela, a resposta fica salva.')).toBeInTheDocument();
      const textbox = screen.getByRole('textbox', { name: 'Mensagem para o Tutor' });
      expect(textbox).toBeDisabled();
      expect(textbox).toHaveAttribute('placeholder', 'Aguardando a resposta');
      view.unmount();
    }
  });

  it('a failed answer offers a retry', async () => {
    serveThread(() => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status: 'failed', error: 'MODEL_TIMEOUT' })] }));
    const timeout = renderThread();
    expect(await screen.findByText('O Tutor não conseguiu responder')).toBeInTheDocument();
    expect(screen.getByText('O serviço do modelo não respondeu a tempo. Sua pergunta ficou salva; tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
    timeout.unmount();

    serveThread(() => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status: 'failed', error: 'MODEL_EMPTY' })] }));
    renderThread();
    expect(await screen.findByText('A resposta não pôde ser concluída. Sua pergunta ficou salva; tente de novo.')).toBeInTheDocument();
  });

  it('retry reopens the turn', async () => {
    const user = userEvent.setup();
    let status: 'failed' | 'pending' = 'failed';
    serveThread(
      () => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status, error: status === 'failed' ? 'MODEL_TIMEOUT' : null })] }),
      NOT_AT_CAP,
      {
        'POST /chat/conversations/c-1/messages/m-2/retry': () => {
          status = 'pending';
          return { assistantMessageId: 'm-2' };
        },
      },
    );
    renderThread();

    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Buscando')).toBeInTheDocument();
    expect(callsTo('POST /chat/conversations/c-1/messages/m-2/retry')).toHaveLength(1);
    expect(callsTo('GET /chat/conversations/c-1').length).toBeGreaterThanOrEqual(2);
  });

  it('the monthly limit shows its reset date', async () => {
    const user = userEvent.setup();
    const expectLimit = async (date: string) => {
      expect(await screen.findByText('Limite do mês atingido.')).toBeInTheDocument();
      expect(screen.getByText(`Volta a ser liberado em ${date}. Suas conversas continuam abertas para leitura.`)).toBeInTheDocument();
      const textbox = screen.getByRole('textbox', { name: 'Mensagem para o Tutor' });
      expect(textbox).toBeDisabled();
      expect(textbox).toHaveAttribute('placeholder', 'Limite do mês atingido');
    };
    const done = conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', text: 'Resposta.' })] });

    serveThread(() => done, AT_CAP);
    const atCap = renderThread();
    await expectLimit('1 de novembro');
    const lastMessage = screen.getAllByTestId('chat-message').at(-1)!;
    expect(lastMessage.compareDocumentPosition(screen.getByTestId('chat-limit')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    atCap.unmount();

    serveThread(() => done, NOT_AT_CAP, {
      'POST /chat/conversations/c-1/messages': () => {
        throw apiError(429, 'CHAT_BUDGET_EXHAUSTED', { resetsAt: '2026-11-01T00:00:00.000Z' });
      },
    });
    const refused = renderThread();
    await user.type(await screen.findByRole('textbox', { name: 'Mensagem para o Tutor' }), 'Mais uma');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await expectLimit('1 de novembro');
    refused.unmount();

    serveThread(() => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status: 'failed', error: 'BUDGET_EXHAUSTED' })] }));
    const failed = renderThread();
    await expectLimit('1 de novembro');
    expect(screen.queryByText('O Tutor não conseguiu responder')).toBeNull();
    failed.unmount();

    await setTestLocale('en-US');
    serveThread(() => done, AT_CAP);
    renderThread();
    expect(await screen.findByText('It opens again on November 1. Your conversations stay open for reading.')).toBeInTheDocument();
  });

  it('missing and failing conversations', async () => {
    const user = userEvent.setup();
    for (const status of [404, 400]) {
      serveThread(() => {
        throw apiError(status);
      });
      const view = renderThread();
      expect(await screen.findByText('Conversa não encontrada.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Começar uma nova' })).toHaveAttribute('href', '/chat');
      view.unmount();
    }

    serveThread(() => {
      throw apiError(500);
    });
    renderThread();
    expect(await screen.findByText('Não foi possível carregar a conversa.')).toBeInTheDocument();
    const before = callsTo('GET /chat/conversations/c-1').length;
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(callsTo('GET /chat/conversations/c-1').length).toBe(before + 1));
  });

  it('send and retry errors show their copy', async () => {
    const user = userEvent.setup();
    const cases: Array<[Error, string]> = [
      [apiError(409, 'CHAT_TURN_IN_PROGRESS'), 'Ainda há uma resposta a caminho nesta conversa.'],
      [apiError(403, 'CHAT_ACCESS_DENIED'), 'O Tutor não está liberado para a sua conta.'],
      [apiError(429), 'Muitas tentativas. Aguarde um momento e tente novamente.'],
      [apiError(500), 'Algo deu errado. Tente novamente.'],
    ];
    const done = conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', text: 'Resposta.' })] });
    for (const [error, copy] of cases) {
      serveThread(() => done, NOT_AT_CAP, {
        'POST /chat/conversations/c-1/messages': () => {
          throw error;
        },
      });
      const view = renderThread();
      await user.type(await screen.findByRole('textbox', { name: 'Mensagem para o Tutor' }), 'Oi');
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(await screen.findByText(copy)).toBeInTheDocument();
      view.unmount();
    }

    serveThread(
      () => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status: 'failed', error: 'MODEL_EMPTY' })] }),
      NOT_AT_CAP,
      {
        'POST /chat/conversations/c-1/messages/m-2/retry': () => {
          throw apiError(409, 'MESSAGE_NOT_RETRYABLE');
        },
      },
    );
    renderThread();
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Só uma resposta que falhou pode ser tentada de novo.')).toBeInTheDocument();
  });

  it('the first read shows a skeleton', async () => {
    serveThread(() => new Promise(() => undefined) as never);

    renderThread();

    expect(await screen.findByTestId('chat-thread-skeleton')).toBeInTheDocument();
    expect(screen.queryAllByTestId('chat-message')).toHaveLength(0);
  });

  it('a bound conversation shows its deck chip', async () => {
    serveThread(() => conversation({ trackedDeckId: 7, messages: [QUESTION] }));
    const bound = renderThread();
    expect(await screen.findByRole('heading', { level: 1, name: 'Katsu nos torneios' })).toBeInTheDocument();
    const chip = await screen.findByRole('link', { name: 'Katsu CC' });
    expect(chip).toHaveAttribute('href', '/decks/7');
    bound.unmount();

    serveThread(() => conversation({ trackedDeckId: null, messages: [QUESTION] }));
    renderThread();
    await screen.findByText('Como o pessoal monta o Katsu?');
    expect(screen.queryByRole('link', { name: 'Katsu CC' })).toBeNull();
  });

  it('the limit banner retries a refused turn once the month has room', async () => {
    const user = userEvent.setup();
    const refused = () => conversation({ messages: [QUESTION, message({ id: 'm-2', role: 'assistant', status: 'failed', error: 'BUDGET_EXHAUSTED' })] });
    serveThread(refused, AT_CAP);
    const atCap = renderThread();
    const capBanner = await screen.findByTestId('chat-limit');
    await waitFor(() => expect(callsTo('GET /chat/usage').length).toBeGreaterThan(0));
    expect(within(capBanner).queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    atCap.unmount();

    serveThread(refused, NOT_AT_CAP, { 'POST /chat/conversations/c-1/messages/m-2/retry': () => ({ assistantMessageId: 'm-2' }) });
    renderThread();
    const banner = await screen.findByTestId('chat-limit');
    await user.click(await within(banner).findByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(callsTo('POST /chat/conversations/c-1/messages/m-2/retry')).toHaveLength(1));
  });
});

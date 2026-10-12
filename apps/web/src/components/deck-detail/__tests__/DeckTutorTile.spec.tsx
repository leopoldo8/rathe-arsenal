import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('../../chat/__tests__/chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('../../chat/__tests__/chat-test-mocks')).routerMock);

import { callsTo, mockApiFetch, mockNavigate, navigatedTo, renderWithClient, serveApi, summary } from '../../chat/__tests__/chat-test-utils';
import type { IChatConversationSummary } from '../../../api/chat';
import { DeckTutorTile } from '../recommendations/DeckTutorTile';

function serveTile(conversations: IChatConversationSummary[]): void {
  serveApi({
    'GET /chat/conversations': () => conversations,
    'POST /chat/conversations': () => ({ id: 'c-1' }),
    'POST /chat/conversations/c-1/messages': () => ({ userMessageId: 'm-1', assistantMessageId: 'm-2' }),
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockNavigate.mockReset();
});

describe('DeckTutorTile', () => {
  it('the tile offers questions about this deck', () => {
    serveTile([]);

    renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);

    expect(screen.getByText('Pergunte ao Tutor')).toBeInTheDocument();
    expect(screen.getByTestId('tutor-mark')).toBeInTheDocument();
    expect(screen.getAllByTestId('tile-question').map((button) => button.textContent)).toEqual([
      'Como outros jogam o Katsu nos torneios?',
      'Que carta deste deck vale trocar?',
      'O que mais falta para ficar pronto?',
    ]);
    expect(screen.getByRole('button', { name: 'Conversar sobre este deck' })).toBeInTheDocument();
  });

  it('the count links to the latest conversation', async () => {
    serveTile([
      summary({ id: 'c-old', trackedDeckId: 7, updatedAt: '2026-10-01T00:00:00.000Z' }),
      summary({ id: 'c-new', trackedDeckId: 7, updatedAt: '2026-10-10T00:00:00.000Z' }),
      summary({ id: 'c-other', trackedDeckId: 9, updatedAt: '2026-10-11T00:00:00.000Z' }),
    ]);
    const two = renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);
    expect(await screen.findByRole('link', { name: '2 conversas' })).toHaveAttribute('href', '/chat/c-new');
    two.unmount();

    serveTile([summary({ id: 'c-only', trackedDeckId: 7 })]);
    const one = renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);
    expect(await screen.findByRole('link', { name: '1 conversa' })).toHaveAttribute('href', '/chat/c-only');
    one.unmount();

    serveTile([summary({ id: 'c-other', trackedDeckId: 9 })]);
    renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);
    await waitFor(() => expect(callsTo('GET /chat/conversations').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('tile-count')).toBeNull();
  });

  it('questions start a bound conversation', async () => {
    const user = userEvent.setup();
    serveTile([]);
    const view = renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);

    await user.click(screen.getByRole('button', { name: 'O que mais falta para ficar pronto?' }));

    await waitFor(() => expect(navigatedTo()).toBe('/chat/c-1'));
    expect(callsTo('POST /chat/conversations')).toEqual([{ trackedDeckId: 7 }]);
    expect(callsTo('POST /chat/conversations/c-1/messages')).toEqual([{ text: 'O que mais falta para ficar pronto?' }]);
    view.unmount();

    mockApiFetch.mockClear();
    mockNavigate.mockReset();
    serveTile([]);
    renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);
    await user.click(screen.getByRole('button', { name: 'Conversar sobre este deck' }));
    expect(navigatedTo()).toBe('/chat?deck=7');
    expect(mockApiFetch.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('./chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('./chat-test-mocks')).routerMock);

import { AT_CAP, conversation, deck, deckProposal, decksResponse, message, renderWithClient, serveApi, summary, swapProposal } from './chat-test-utils';
import { ChatScreen } from '../ChatScreen';
import { DeckTutorTile } from '../../deck-detail/recommendations/DeckTutorTile';

const MONEY = /R\$|US\$|\$\s?\d|USD|BRL/;

describe('no money on the chat screens', () => {
  it('no amount renders anywhere in the chat', async () => {
    serveApi({
      'GET /chat/conversations': () => [summary({ id: 'c-1', trackedDeckId: 7 })],
      'GET /chat/usage': () => AT_CAP,
      'GET /decks': () => decksResponse([deck({ id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer' })]),
      'GET /chat/conversations/c-1': () =>
        conversation({
          trackedDeckId: 7,
          messages: [
            message({ id: 'm-1', role: 'user', text: 'Ideias?' }),
            message({ id: 'm-2', role: 'assistant', text: 'Duas propostas.', proposals: [deckProposal(), swapProposal()] }),
          ],
        }),
    });

    const { container } = renderWithClient(
      <>
        <ChatScreen conversationId="c-1" draftDeckId={null} />
        <DeckTutorTile deckId={7} heroName="Katsu" />
      </>,
    );
    await screen.findByText('Limite do mês atingido.');
    await screen.findAllByTestId('proposal-card');

    expect(container.textContent).not.toMatch(MONEY);
    expect(container.textContent).not.toMatch(/\b5(?:[.,]0+)?\s*(?:dólares|dollars|reais)/i);
  });

  it('a priced swap card shows the store price and no spend figure', async () => {
    const base = swapProposal();
    const priced = swapProposal({
      display: { ...base.display, replacement: { ...base.display.replacement, storePriceCents: 250 } },
    });
    serveApi({
      'GET /chat/conversations': () => [summary({ id: 'c-1', trackedDeckId: 7 })],
      'GET /chat/usage': () => AT_CAP,
      'GET /decks': () => decksResponse([deck({ id: 7, name: 'Katsu CC', hero: 'Katsu, the Wanderer' })]),
      'GET /chat/conversations/c-1': () =>
        conversation({
          trackedDeckId: 7,
          messages: [
            message({ id: 'm-1', role: 'user', text: 'Ideias?' }),
            message({ id: 'm-2', role: 'assistant', text: 'Uma troca.', proposals: [deckProposal(), priced] }),
          ],
        }),
    });

    const { container } = renderWithClient(
      <>
        <ChatScreen conversationId="c-1" draftDeckId={null} />
        <DeckTutorTile deckId={7} heroName="Katsu" />
      </>,
    );
    await screen.findByText('Limite do mês atingido.');
    await screen.findAllByTestId('proposal-card');

    const text = (container.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('R$ 2,50 na Cúpula DT');
    expect(text.match(/R\$/g)).toHaveLength(1);
    expect(text).not.toMatch(/US\$|USD|BRL/);
    expect(text).not.toMatch(/\b5(?:[.,]0+)?\s*(?:dólares|dollars|reais)/i);
  });
});

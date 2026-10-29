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
import { blitzDraft, verdictOf } from './rulesChecklistTestData';

const RHINAR_NAME = 'Rhinar, Reckless Rampage';

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
    expect(screen.getAllByTestId('tile-question').map((button) => button.textContent)).toEqual([
      'Como outros jogam o Katsu nos torneios?',
      'Que carta deste deck vale trocar?',
      'O que ainda impede este deck de ficar pronto?',
    ]);
    const start = screen.getByRole('button', { name: 'Conversar sobre este deck' });
    expect(start.querySelector('[data-testid="tutor-mark"]')).not.toBeNull();
    expect(screen.getByText('Pergunte ao Tutor').parentElement?.querySelector('[data-testid="tutor-mark"]')).not.toBeNull();
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

    await user.click(screen.getByRole('button', { name: 'O que ainda impede este deck de ficar pronto?' }));

    await waitFor(() => expect(navigatedTo()).toBe('/chat/c-1'));
    expect(callsTo('POST /chat/conversations')).toEqual([{ trackedDeckId: 7 }]);
    expect(callsTo('POST /chat/conversations/c-1/messages')).toEqual([{ text: 'O que ainda impede este deck de ficar pronto?' }]);
    view.unmount();

    mockApiFetch.mockClear();
    mockNavigate.mockReset();
    serveTile([]);
    renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);
    await user.click(screen.getByRole('button', { name: 'Conversar sobre este deck' }));
    expect(navigatedTo()).toBe('/chat?deck=7');
    expect(mockApiFetch.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);
  });

  it("the first question follows the deck's state", () => {
    const cases: Array<[string, Parameters<typeof blitzDraft>[0], string]> = [
      ['a rule problem', { deckCards: 31, packHuntCopies: 2 }, 'Como deixo este deck válido no Blitz?'],
      ['short of cards only', { deckCards: 31, packHuntCopies: 1 }, 'Quais cartas coloco para chegar a 40?'],
      ['neither', { deckCards: 40, packHuntCopies: 1 }, `Como outros jogam o ${RHINAR_NAME} nos torneios?`],
    ];
    for (const [, options, first] of cases) {
      serveTile([]);
      const draft = blitzDraft(options);
      const view = renderWithClient(<DeckTutorTile deckId={7} heroName={RHINAR_NAME} legality={verdictOf(draft)} format="Blitz" />);

      expect(screen.getAllByTestId('tile-question')[0]).toHaveTextContent(first);
      view.unmount();
    }
  });

  it("the tile's other two questions", () => {
    serveTile([]);
    renderWithClient(<DeckTutorTile deckId={7} heroName="Katsu" />);

    const questions = screen.getAllByTestId('tile-question').map((button) => button.textContent);
    expect(questions.slice(1)).toEqual(['Que carta deste deck vale trocar?', 'O que ainda impede este deck de ficar pronto?']);
    expect(questions).not.toContain('O que mais falta para ficar pronto?');
  });

  it('the tile follows b2-deck-ask-phone', () => {
    serveTile([]);
    const draft = blitzDraft({ deckCards: 31, packHuntCopies: 2 });
    renderWithClient(<DeckTutorTile deckId={7} heroName={RHINAR_NAME} legality={verdictOf(draft)} format="Blitz" />);

    const tile = screen.getByTestId('tutor-tile');
    const ordered = [
      screen.getByText('Pergunte ao Tutor'),
      ...screen.getAllByTestId('tile-question'),
      screen.getByRole('button', { name: 'Conversar sobre este deck' }),
    ];
    expect(ordered.map((node) => node.textContent)).toEqual([
      'Pergunte ao Tutor',
      'Como deixo este deck válido no Blitz?',
      'Que carta deste deck vale trocar?',
      'O que ainda impede este deck de ficar pronto?',
      'Conversar sobre este deck',
    ]);
    ordered.slice(1).forEach((node, index) => expect(ordered[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
    expect(tile).toContainElement(ordered[0]!);
  });
});

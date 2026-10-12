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

import { apiError, callsTo, deck, decksResponse, deckProposal, mockApiFetch, renderWithClient, serveApi, swapProposal } from './chat-test-utils';
import type { TChatProposal, TProposalStatus } from '../../../api/chat';
import { chatConversationQueryKey } from '../../../api/chat';
import { DECKS_QUERY_KEY } from '../../../api/decks';
import { ProposalCard } from '../ProposalCard';

const OSCILIO = deck({ id: 7, name: 'Oscilio Azul Tempo', hero: 'Oscilio' });

function renderCard(proposal: TChatProposal, extra: Record<string, (body: unknown) => unknown> = {}) {
  serveApi({ 'GET /decks': () => decksResponse([OSCILIO]), ...extra });
  return renderWithClient(<ProposalCard conversationId="c-1" proposal={proposal} />);
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe('ProposalCard', () => {
  it('a deck proposal shows what it builds', () => {
    renderCard(deckProposal());

    const card = screen.getByTestId('proposal-card');
    expect(within(card).getByText('Proposta de deck')).toBeInTheDocument();
    expect(within(card).getByText('Katsu Tempo')).toBeInTheDocument();
    expect(within(card).getByText('Katsu, the Wanderer · Classic Constructed · 60 cartas')).toBeInTheDocument();
    expect(within(card).getByText('Pendente')).toBeInTheDocument();
    expect(within(card).getByText('Aproveita o que você já tem.')).toBeInTheDocument();
    expect(within(card).getByText('41 você tem')).toBeInTheDocument();
    expect(within(card).getByText('19 faltam')).toBeInTheDocument();
    const rows = within(card).getAllByTestId('proposal-card-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      '3xEmissary of Tidestem',
      '3xFlextem',
      '2xLunging Pressfalta 1',
      '3xSpringboard Somersaultfalta 3',
    ]);
    expect(within(card).getByText('e mais 1 carta')).toBeInTheDocument();
  });

  it('a swap proposal shows what goes out and in', async () => {
    const pending = renderCard(swapProposal());
    const card = screen.getByTestId('proposal-card');
    expect(within(card).getByText('Proposta de troca')).toBeInTheDocument();
    expect(await within(card).findByRole('link', { name: 'Oscilio Azul Tempo' })).toHaveAttribute('href', '/decks/7');
    const out = within(card).getByTestId('swap-out');
    const into = within(card).getByTestId('swap-in');
    expect([within(out).getByText('Sai'), within(out).getByText('Flex'), within(out).getByText('2 cópias no deck')]).toHaveLength(3);
    expect([within(into).getByText('Entra'), within(into).getByText('Emissary of Tides'), within(into).getByText('você tem 3')]).toHaveLength(3);
    pending.unmount();

    renderCard(swapProposal({ display: { ...swapProposal().display, replacement: { ...swapProposal().display.replacement, freeCopies: 0 } } }));
    expect(screen.getByText('você não tem cópias livres')).toBeInTheDocument();
  });

  it('each status shows its badge and actions', () => {
    const badges: Record<TProposalStatus, string> = { pending: 'Pendente', applied: 'Aplicada', dismissed: 'Dispensada', stale: 'Desatualizada' };
    const statuses: TProposalStatus[] = ['pending', 'applied', 'dismissed', 'stale'];
    for (const kind of ['deck', 'swap'] as const) {
      for (const status of statuses) {
        const proposal = kind === 'deck' ? deckProposal({ status, trackedDeckId: status === 'applied' ? 42 : null }) : swapProposal({ status });
        const view = renderCard(proposal);
        const card = screen.getByTestId('proposal-card');
        const deckLinkTarget = kind === 'deck' ? '/decks/42' : '/decks/7';

        expect(within(card).getByTestId('proposal-status').textContent).toBe(badges[status]);
        expect(within(card).queryByRole('button', { name: kind === 'deck' ? 'Aplicar' : 'Aplicar troca' }) !== null).toBe(status === 'pending');
        expect(within(card).queryByRole('button', { name: 'Dispensar' }) !== null).toBe(status === 'pending');
        expect(within(card).queryByText(kind === 'deck' ? 'Deck criado como ideia.' : 'Troca aplicada.') !== null).toBe(status === 'applied');
        const openDeck = within(card).queryByRole('link', { name: 'Abrir deck' });
        expect(openDeck?.getAttribute('href') ?? null).toBe(status === 'applied' ? deckLinkTarget : null);
        expect(within(card).queryByText('Esta proposta não vale mais: o deck mudou desde a resposta.') !== null).toBe(status === 'stale');
        view.unmount();
      }
    }
  });

  it('applying refetches and refreshes decks', async () => {
    const user = userEvent.setup();
    const view = renderCard(deckProposal(), { 'POST /chat/proposals/p-1/apply': () => ({ trackedDeckId: 42 }) });
    const invalidate = vi.spyOn(view.client, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(callsTo('POST /chat/proposals/p-1/apply')).toHaveLength(1));
    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      expect(keys).toContain(JSON.stringify(chatConversationQueryKey('c-1')));
      expect(keys).toContain(JSON.stringify(DECKS_QUERY_KEY));
    });
  });

  it('dismissing refetches', async () => {
    const user = userEvent.setup();
    const view = renderCard(swapProposal({ id: 'p-1' }), { 'POST /chat/proposals/p-1/dismiss': () => ({ id: 'p-1', status: 'dismissed' }) });
    const invalidate = vi.spyOn(view.client, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Dispensar' }));

    await waitFor(() => expect(callsTo('POST /chat/proposals/p-1/dismiss')).toHaveLength(1));
    await waitFor(() =>
      expect(invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))).toContain(JSON.stringify(chatConversationQueryKey('c-1'))),
    );
  });

  it('a refused decision refetches and explains', async () => {
    const user = userEvent.setup();
    for (const [code, copy] of [
      ['PROPOSAL_STALE', 'Esta proposta não vale mais para o deck.'],
      ['PROPOSAL_NOT_PENDING', 'Esta proposta já foi decidida.'],
    ] as const) {
      const view = renderCard(deckProposal(), {
        'POST /chat/proposals/p-1/apply': () => {
          throw apiError(409, code);
        },
      });
      const invalidate = vi.spyOn(view.client, 'invalidateQueries');

      await user.click(screen.getByRole('button', { name: 'Aplicar' }));

      expect(await within(screen.getByTestId('proposal-card')).findByText(copy)).toBeInTheDocument();
      expect(invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))).toContain(JSON.stringify(chatConversationQueryKey('c-1')));
      view.unmount();
    }
  });
});

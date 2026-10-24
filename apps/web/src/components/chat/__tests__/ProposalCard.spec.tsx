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
  it('a deck proposal shows what it builds', async () => {
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
      '3xEmissary of Tides (Azul)tem',
      '3xFlex (Vermelho)tem',
      '2xLunging Press (Amarelo)falta 1',
      '3xSpringboard Somersault (Azul)falta 3',
    ]);
    expect(within(card).getByText('e mais 1 carta')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: '41 de 60 cartas na sua coleção' })).toBeInTheDocument();
    await waitFor(() => expect(within(card).getByTestId('owned-share').style.getPropertyValue('--owned-share')).toMatch(/^68\.33\d*%$/));
    expect(rows.map((row) => row.querySelector('[data-pitch]')?.getAttribute('data-pitch'))).toEqual(['3', '1', '2', '3']);
  });

  it('a swap proposal shows what goes out and in', async () => {
    const pending = renderCard(swapProposal());
    const card = screen.getByTestId('proposal-card');
    expect(within(card).getByText('Proposta de troca')).toBeInTheDocument();
    expect(await within(card).findByRole('link', { name: 'Oscilio Azul Tempo' })).toHaveAttribute('href', '/decks/7');
    const out = within(card).getByTestId('swap-out');
    const into = within(card).getByTestId('swap-in');
    expect([within(out).getByText('Sai'), within(out).getByText('Flex (Vermelho)'), within(out).getByText('2 cópias no deck')]).toHaveLength(3);
    expect([within(into).getByText('Entra'), within(into).getByText('Emissary of Tides (Azul)'), within(into).getByText('você tem 3')]).toHaveLength(3);
    expect([out.querySelector('[data-pitch]')?.getAttribute('data-pitch'), into.querySelector('[data-pitch]')?.getAttribute('data-pitch')]).toEqual(['1', '3']);
    pending.unmount();

    renderCard(swapProposal({ display: { ...swapProposal().display, replacement: { ...swapProposal().display.replacement, freeCopies: 0 } } }));
    expect(screen.getByText('você não tem cópias livres')).toBeInTheDocument();
  });

  it('both cards of a swap name the pitch', () => {
    renderCard(swapProposal());

    const out = screen.getByTestId('swap-out');
    const into = screen.getByTestId('swap-in');
    expect(within(out).getAllByText('Flex (Vermelho)').length).toBeGreaterThan(0);
    expect(within(into).getAllByText('Emissary of Tides (Azul)').length).toBeGreaterThan(0);
    expect(within(out).getByRole('button', { name: /Flex \(Vermelho\)/ })).toBeInTheDocument();
    expect(within(into).getByRole('button', { name: /Emissary of Tides \(Azul\)/ })).toBeInTheDocument();
    expect(within(out).queryByText('Flex')).toBeNull();
  });

  it('a swap proposal shows both card images and opens each one large', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    renderCard(swapProposal());
    const out = screen.getByTestId('swap-out');
    const into = screen.getByTestId('swap-in');

    expect(within(out).getByRole('img', { name: 'Flex (Vermelho)' })).toHaveAttribute('src', 'https://cards.example/large/FLEX.webp');
    expect(within(into).getByRole('img', { name: 'Emissary of Tides (Azul)' })).toHaveAttribute('src', 'https://cards.example/large/EMISSARY.webp');
    await userEvent.click(within(into).getByRole('button', { name: 'Ver Emissary of Tides (Azul)' }));
    const lightbox = await screen.findByRole('dialog');
    expect(within(lightbox).getByRole('img', { name: 'Emissary of Tides' })).toHaveAttribute('src', 'https://cards.example/large/EMISSARY.webp');
  });

  it('a swap card with no image shows its name in place of the art and opens nothing', () => {
    const display = swapProposal().display;
    renderCard(swapProposal({ display: { ...display, original: { ...display.original, imageUrl: null } } }));
    const out = screen.getByTestId('swap-out');

    expect(within(out).queryByRole('img')).toBeNull();
    expect(within(out).queryByRole('button')).toBeNull();
    expect(within(out).getByTestId('swap-art-fallback')).toHaveTextContent('Flex (Vermelho)');
  });

  it('each status shows its badge and actions', () => {
    const badges: Record<TProposalStatus, string> = { pending: 'Pendente', applied: 'Aplicada', dismissed: 'Dispensada', stale: 'Desatualizada' };
    const statuses: TProposalStatus[] = ['pending', 'applied', 'dismissed', 'stale'];
    for (const kind of ['deck', 'swap'] as const) {
      for (const status of statuses) {
        const proposal =
          kind === 'deck'
            ? deckProposal({ status, trackedDeckId: status === 'applied' ? 42 : null })
            : swapProposal({ status, ...(status === 'applied' ? { cardReplacementId: 'r-1', replacementStatus: 'active' } : {}) });
        const view = renderCard(proposal);
        const card = screen.getByTestId('proposal-card');

        expect(within(card).getByTestId('proposal-status').textContent).toBe(badges[status]);
        expect(within(card).queryByRole('button', { name: kind === 'deck' ? 'Aplicar' : 'Aplicar troca' }) !== null).toBe(status === 'pending');
        expect(within(card).queryByRole('button', { name: 'Dispensar' }) !== null).toBe(status === 'pending');
        expect(within(card).queryByText(kind === 'deck' ? 'Deck criado como ideia.' : 'Troca feita no deck.') !== null).toBe(status === 'applied');
        const openDeck = within(card).queryByRole('link', { name: 'Abrir deck' });
        expect(openDeck?.getAttribute('href') ?? null).toBe(status === 'applied' && kind === 'deck' ? '/decks/42' : null);
        expect(within(card).queryByRole('button', { name: 'Desfazer' }) !== null).toBe(status === 'applied' && kind === 'swap');
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

  it('undoing an applied swap reverts it', async () => {
    const user = userEvent.setup();
    const active = renderCard(swapProposal({ status: 'applied', cardReplacementId: 'r-1', replacementStatus: 'active' }), {
      'POST /replacements/r-1/revert': () => ({ replacement: { id: 'r-1' } }),
    });
    const invalidate = vi.spyOn(active.client, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(callsTo('POST /replacements/r-1/revert')).toHaveLength(1));
    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      expect(keys).toContain(JSON.stringify(chatConversationQueryKey('c-1')));
      expect(keys).toContain(JSON.stringify(DECKS_QUERY_KEY));
    });
    active.unmount();

    renderCard(swapProposal({ status: 'applied', cardReplacementId: 'r-1', replacementStatus: 'reverted' }));
    expect(screen.getByText('Troca desfeita.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
    expect(screen.queryByText('Troca feita no deck.')).toBeNull();
  });

  it('an applied swap reads its replacement status', () => {
    const cases = [
      ['active', 'Troca feita no deck.', true],
      ['kept', 'Troca feita no deck.', false],
      ['reverted', 'Troca desfeita.', false],
      ['removed', 'A troca saiu do deck.', false],
      [null, 'Troca feita no deck.', false],
    ] as const;
    for (const [replacementStatus, copy, undoable] of cases) {
      const view = renderCard(swapProposal({ status: 'applied', cardReplacementId: replacementStatus === null ? null : 'r-1', replacementStatus }));
      const card = screen.getByTestId('proposal-card');

      expect([within(card).queryByText(copy) !== null, within(card).queryByRole('button', { name: 'Desfazer' }) !== null]).toEqual([true, undoable]);
      view.unmount();
    }
  });

  it('a refused undo or dismiss refetches and explains', async () => {
    const user = userEvent.setup();
    const undo = renderCard(swapProposal({ status: 'applied', cardReplacementId: 'r-1', replacementStatus: 'active' }), {
      'POST /replacements/r-1/revert': () => {
        throw apiError(409, 'REPLACEMENT_NOT_ACTIVE');
      },
    });
    const undoInvalidate = vi.spyOn(undo.client, 'invalidateQueries');
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByText('Esta substituição já foi resolvida.')).toBeInTheDocument();
    expect(undoInvalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))).toContain(JSON.stringify(chatConversationQueryKey('c-1')));
    undo.unmount();

    const dismiss = renderCard(swapProposal({ id: 'p-1' }), {
      'POST /chat/proposals/p-1/dismiss': () => {
        throw apiError(409, 'PROPOSAL_NOT_PENDING');
      },
    });
    const dismissInvalidate = vi.spyOn(dismiss.client, 'invalidateQueries');
    await user.click(screen.getByRole('button', { name: 'Dispensar' }));
    expect(await screen.findByText('Esta proposta já foi decidida.')).toBeInTheDocument();
    expect(dismissInvalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))).toContain(JSON.stringify(chatConversationQueryKey('c-1')));
  });
});

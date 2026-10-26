import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('./chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('./chat-test-mocks')).routerMock);

import { apiError, callsTo, deck, decksResponse, deckProposal, mockApiFetch, renderWithClient, serveApi, swapFacts, swapProposal } from './chat-test-utils';
import type { ISwapProposal, TChatProposal, TProposalStatus } from '../../../api/chat';
import { chatConversationQueryKey } from '../../../api/chat';
import { DECKS_QUERY_KEY } from '../../../api/decks';
import { ProposalCard } from '../ProposalCard';

const OSCILIO = deck({ id: 7, name: 'Oscilio Azul Tempo', hero: 'Oscilio' });
const RHINAR_CC = deck({ id: 9, name: 'Rhinar CC', hero: 'Rhinar, Reckless Rampage' });

/** The swap of `r2-proposal-desktop`: one Pack Hunt (Vermelho) out of the inventory, Wounding Blow (Vermelho) in. */
function packHuntSwap(overrides: Partial<ISwapProposal> = {}, replacement: Partial<ISwapProposal['display']['replacement']> = {}): ISwapProposal {
  const base = swapProposal();
  return {
    ...base,
    trackedDeckId: 9,
    payload: { trackedDeckId: 9, slot: 'mainboard', quantity: 1, side: 'inventory', missingBefore: 7, missingAfter: 8 },
    reason: 'Com isso, Pack Hunt (Vermelho) volta para 3 no total, o limite do Classic Constructed.',
    display: {
      original: { ...base.display.original, cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, copiesInDeck: 3, copiesLeft: 3, facts: swapFacts({ cost: 2, power: 6, defense: 3 }) },
      replacement: {
        ...base.display.replacement,
        cardIdentifier: 'wounding-blow-red',
        name: 'Wounding Blow',
        pitch: 1,
        freeCopies: 0,
        storePriceCents: 250,
        facts: swapFacts({ cost: 0, power: 4, defense: 3 }),
        ...replacement,
      },
    },
    ...overrides,
  };
}

function renderRhinar(proposal: ISwapProposal) {
  serveApi({ 'GET /decks': () => decksResponse([RHINAR_CC]) });
  return renderWithClient(<ProposalCard conversationId="c-1" proposal={proposal} />);
}

const textOf = (element: HTMLElement): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

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
    expect([within(out).getByText('Sai'), within(out).getByText('Flex (Vermelho), a cópia do inventário'), within(out).getByText('Ficam 2 no deck.')]).toHaveLength(3);
    expect([within(into).getByText('Entra'), within(into).getByText('Emissary of Tides (Azul) no inventário'), within(into).getByText(/você tem 3 livres/)]).toHaveLength(3);
    expect([out.querySelector('[data-pitch]')?.getAttribute('data-pitch'), into.querySelector('[data-pitch]')?.getAttribute('data-pitch')]).toEqual(['1', '3']);
    pending.unmount();

    renderCard(swapProposal({ display: { ...swapProposal().display, replacement: { ...swapProposal().display.replacement, freeCopies: 0 } } }));
    expect(screen.getByText(/você não tem nenhuma na coleção/)).toBeInTheDocument();
  });

  it('both cards of a swap name the pitch', () => {
    renderCard(swapProposal());

    const out = screen.getByTestId('swap-out');
    const into = screen.getByTestId('swap-in');
    expect(within(out).getAllByText(/^Flex \(Vermelho\)/).length).toBeGreaterThan(0);
    expect(within(into).getAllByText(/^Emissary of Tides \(Azul\)/).length).toBeGreaterThan(0);
    expect(within(out).getByRole('button', { name: /Flex \(Vermelho\)/ })).toBeInTheDocument();
    expect(within(into).getByRole('button', { name: /Emissary of Tides \(Azul\)/ })).toBeInTheDocument();
    expect(within(out).queryByText(/^Flex(,|$)/)).toBeNull();
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
        expect(within(card).queryByRole('button', { name: kind === 'deck' ? 'Aplicar' : 'Trocar 1 cópia' }) !== null).toBe(status === 'pending');
        expect(within(card).queryByRole('button', { name: 'Dispensar' }) !== null).toBe(status === 'pending');
        expect(within(card).queryByText(kind === 'deck' ? 'Deck criado como ideia.' : 'Troca feita no deck.') !== null).toBe(status === 'applied');
        const openDeck = within(card).queryByRole('link', { name: 'Abrir deck' });
        expect(openDeck?.getAttribute('href') ?? null).toBe(status === 'applied' && kind === 'deck' ? '/decks/42' : null);
        expect(within(card).queryByRole('button', { name: 'Desfazer' }) !== null).toBe(status === 'applied' && kind === 'swap');
        expect(within(card).queryByRole('link', { name: 'Ver no deck' }) !== null).toBe(status === 'applied' && kind === 'swap');
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

  it('a swap proposal says how many copies move and from which side', () => {
    renderRhinar(packHuntSwap());

    const out = screen.getByTestId('swap-out-text');
    const into = screen.getByTestId('swap-in-text');
    expect(textOf(out)).toBe('Sai: 1 Pack Hunt (Vermelho), a cópia do inventário. Ficam 3 no deck.');
    expect(textOf(into)).toContain('Entra: 1 Wounding Blow (Vermelho) no inventário');
    expect(screen.getByRole('button', { name: 'Trocar 1 cópia' })).toBeInTheDocument();
    cleanup();

    renderRhinar(
      packHuntSwap({ payload: { trackedDeckId: 9, slot: 'mainboard', quantity: 1, side: 'deck', missingBefore: 7, missingAfter: 8 } }),
    );
    expect(textOf(screen.getByTestId('swap-in-text'))).toContain('Entra: 1 Wounding Blow (Vermelho) no deck');
  });

  it('the incoming card says its free copies and its Cúpula DT price', () => {
    const lines: Array<[Partial<ISwapProposal['display']['replacement']>, string]> = [
      [{ freeCopies: 0, storePriceCents: 250 }, 'você não tem nenhuma na coleção · R$ 2,50 na Cúpula DT'],
      [{ freeCopies: 2, storePriceCents: 250 }, 'você tem 2 livres · R$ 2,50 na Cúpula DT'],
      [{ freeCopies: 1, storePriceCents: null }, 'você tem 1 livre · sem preço na Cúpula DT'],
      [{ freeCopies: 0, storePriceCents: null }, 'você não tem nenhuma na coleção · sem preço na Cúpula DT'],
    ];
    for (const [replacement, line] of lines) {
      const view = renderRhinar(packHuntSwap({}, replacement));
      const into = textOf(screen.getByTestId('swap-in-text'));

      expect(into).toContain(line);
      expect(into).not.toMatch(/você não tem(?! nenhuma)/);
      expect(into).not.toContain('cópias livres');
      view.unmount();
    }
  });

  it('the swap card shows why this card and the stored effect on the missing copies', () => {
    renderRhinar(packHuntSwap());

    const card = screen.getByTestId('proposal-card');
    expect(textOf(within(card).getByTestId('swap-why'))).toBe(
      'Por que esta carta: Wounding Blow (Vermelho) é um ataque de custo 0, com 4 de poder e 3 de defesa. Pack Hunt (Vermelho), que sai, é um ataque de custo 2, com 6 de poder e 3 de defesa.',
    );
    expect(textOf(within(card).getByTestId('swap-effect'))).toBe('Depois da troca: faltam 8 cópias para fechar o deck (eram 7).');
  });

  it('a swap card with no stored effect leaves the effect line out', () => {
    const proposal = packHuntSwap();
    renderRhinar({ ...proposal, payload: { trackedDeckId: 9, slot: 'mainboard' } });

    expect(screen.queryByTestId('swap-effect')).toBeNull();
  });

  it('an applied swap reads Troca feita no deck. with Desfazer and Ver no deck', () => {
    renderRhinar(packHuntSwap({ status: 'applied', cardReplacementId: 'r-1', replacementStatus: 'active' }));

    const card = screen.getByTestId('proposal-card');
    expect(within(card).getByTestId('proposal-status')).toHaveTextContent('Aplicada');
    expect(within(card).getByText('Troca feita no deck.')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Ver no deck' })).toHaveAttribute('href', '/decks/9');
  });

  it('the pending swap card follows r2-proposal-desktop', async () => {
    renderRhinar(packHuntSwap());

    const card = screen.getByTestId('proposal-card');
    expect(await within(card).findByText('Rhinar CC')).toBeInTheDocument();
    const order = [
      'Proposta de troca',
      'Pendente',
      'Rhinar CC',
      'Sai',
      'Pack Hunt (Vermelho), a cópia do inventário',
      'Ficam 3 no deck.',
      'Entra',
      'Wounding Blow (Vermelho) no inventário',
      'você não tem nenhuma na coleção · R$ 2,50 na Cúpula DT',
      'Com isso, Pack Hunt (Vermelho) volta para 3 no total, o limite do Classic Constructed.',
      'Por que esta carta:',
      'Depois da troca: faltam 8 cópias para fechar o deck (eram 7).',
      'Trocar 1 cópia',
      'Dispensar',
    ];
    const text = textOf(card);
    const positions = order.map((fragment) => text.indexOf(fragment));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(within(card).getByTestId('swap-out-text')).toHaveTextContent(/Sai:?\s*1/);
    expect(within(card).getByTestId('swap-in-text')).toHaveTextContent(/Entra:?\s*1/);
    expect(within(card).queryByText('Troca feita no deck.')).toBeNull();
    const buttons = within(card).getAllByRole('button').map((button) => button.textContent);
    expect(buttons.slice(-2)).toEqual(['Trocar 1 cópia', 'Dispensar']);
  });

  it('the applied swap card follows r2-applied-desktop', async () => {
    renderRhinar(packHuntSwap({ status: 'applied', cardReplacementId: 'r-1', replacementStatus: 'active' }));

    const card = screen.getByTestId('proposal-card');
    expect(await within(card).findByText('Rhinar CC')).toBeInTheDocument();
    const order = [
      'Proposta de troca',
      'Aplicada',
      'Rhinar CC',
      'Sai',
      'Entra',
      'Por que esta carta:',
      'Depois da troca: faltam 8 cópias para fechar o deck (eram 7).',
      'Troca feita no deck.',
      'Desfazer',
      'Ver no deck',
    ];
    const text = textOf(card);
    const positions = order.map((fragment) => text.indexOf(fragment));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(within(card).queryByRole('button', { name: 'Trocar 1 cópia' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Dispensar' })).toBeNull();
  });
});

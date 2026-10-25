import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RULE_CHANGES, type IRuleChange } from '@rathe-arsenal/engine/legality';
import { ToastProvider } from '../../ui/Toast/ToastProvider';
import { useDeckDetailQuery, type IDeckDetailResponse } from '../../../api/deck-detail';
import { buildDraftInitialPayload } from '../../../routes/_auth/-deck-detail-draft';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { createDeckServer, deckFetch, DeckPageHarness, type IDeckServer } from './deckPageKit';
import {
  RHINAR,
  TWO_OFS,
  bannedProblem,
  copiesProblem,
  legalityOfComposition,
  rhinarBlitzDeck,
} from './ruleChangedFixture';

const apiFetch = vi.hoisted(() => ({ current: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => (path: string, init?: RequestInit) => apiFetch.current(path, init) };
});
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false } }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, 'aria-label': ariaLabel }: { children: React.ReactNode; to: string; className?: string; 'aria-label'?: string }) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => <div data-testid="tag-row" /> }));
vi.mock('../DeckAnalysisRow', () => ({ DeckAnalysisRow: () => <div data-testid="analysis-row" /> }));
vi.mock('../recommendations/RecommendationsRail', () => ({ RecommendationsRail: () => <section /> }));

import { RuleChangedNotice } from '../RuleChangedNotice';

const NOTICE =
  'Desde 9 de março de 2026, o Blitz permite 1 cópia de cada carta (antes eram 2). 8 cartas deste deck têm 2.';
const HINT =
  'Tira 1 cópia de cada uma das 8 cartas. O deck fica com 32 de 40 e você coloca mais 8. As cartas continuam na sua coleção.';

function putHandler(server: IDeckServer): (body: unknown) => unknown {
  return (body) => {
    const { cards } = body as { cards: { cardIdentifier: string; quantity: number; inventoryQuantity: number }[] };
    const next = server.deck.latestSnapshot!.breakdown.exact.map((line) => {
      const saved = cards.find((card) => card.cardIdentifier === line.cardIdentifier);
      return saved === undefined ? null : { ...line, quantity: saved.quantity + saved.inventoryQuantity };
    });
    const exact = next.filter((line): line is NonNullable<typeof line> => line !== null);
    const deckCards = exact.reduce((sum, line) => sum + line.quantity, 0);
    const details = TWO_OFS.filter((card) => exact.find((line) => line.cardIdentifier === card.id)?.quantity === 2).map((card) =>
      copiesProblem(card),
    );
    server.deck = {
      ...server.deck,
      totalCards: deckCards,
      latestSnapshot: { ...server.deck.latestSnapshot!, breakdown: { ...server.deck.latestSnapshot!.breakdown, exact } },
      legality: legalityOfComposition(deckCards, details),
    } as IDeckDetailResponse;
    return undefined;
  };
}

function newServer(deck: IDeckDetailResponse = rhinarBlitzDeck()): IDeckServer {
  const server = createDeckServer(deck, [RHINAR]);
  server.handlers.set('PUT /decks/1', putHandler(server));
  apiFetch.current = deckFetch(server);
  return server;
}

function putCalls(server: IDeckServer): readonly { body: { cards: { cardIdentifier: string; quantity: number }[] } }[] {
  return server.calls.filter((call) => call.method === 'PUT') as never;
}

function providers(ui: React.ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

function NoticeFromServer({ ruleChanges }: { readonly ruleChanges?: readonly IRuleChange[] }): React.ReactElement | null {
  const detail = useDeckDetailQuery('1');
  const deck = detail.data;
  if (deck === undefined || deck.latestSnapshot === null) return null;
  const { cards } = buildDraftInitialPayload(deck, deck.latestSnapshot);
  return (
    <>
      <span data-testid="deck-loaded" />
      <RuleChangedNotice
        deckId={deck.id}
        format={deck.format}
        heroIdentifier={deck.heroIdentifier}
        legality={deck.legality}
        cards={cards}
        {...(ruleChanges === undefined ? {} : { ruleChanges })}
      />
    </>
  );
}

describe('RuleChangedNotice', () => {
  beforeEach(async () => {
    await setTestLocale('pt-BR');
    apiFetch.current = vi.fn();
  });

  it('the notice reads the curated entry', async () => {
    newServer();
    providers(<NoticeFromServer />);

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ver o anúncio/ });
    expect(link).toHaveAttribute('href', RULE_CHANGES[0]!.sourceUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')?.split(' ').sort()).toEqual(['noopener', 'noreferrer']);
  });

  it('the date comes only from the entry', async () => {
    newServer();
    const later: IRuleChange = { ...RULE_CHANGES[0]!, effectiveDate: '2026-04-01' };
    const { unmount } = providers(<NoticeFromServer ruleChanges={[later]} />);

    expect(await screen.findByText(/^Desde 1 de abril de 2026,/)).toBeInTheDocument();
    unmount();

    providers(<NoticeFromServer ruleChanges={[]} />);

    await screen.findByTestId('deck-loaded');
    expect(document.body.textContent).not.toMatch(/Desde|antes eram/);
  });

  it('keep one of each takes one copy out with undo', async () => {
    const server = newServer();
    providers(<NoticeFromServer />);

    await userEvent.click(await screen.findByRole('button', { name: 'Deixar 1 de cada' }));

    expect(await screen.findByText('8 cópias tiradas do deck')).toBeInTheDocument();
    expect(putCalls(server)).toHaveLength(1);
    const saved = putCalls(server)[0]!.body.cards;
    for (const card of TWO_OFS) expect(saved.find((line) => line.cardIdentifier === card.id)?.quantity).toBe(1);
    expect(saved).toHaveLength(32);
    expect(server.calls.some((call) => call.path.includes('collection'))).toBe(false);
    expect(await screen.findByTestId('rule-change-result')).toHaveTextContent('32 de 40 cartas · nenhum problema');
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(putCalls(server)).toHaveLength(2));
    const restored = putCalls(server)[1]!.body.cards;
    for (const card of TWO_OFS) expect(restored.find((line) => line.cardIdentifier === card.id)?.quantity).toBe(2);
    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByTestId('rule-change-result')).not.toBeInTheDocument();
  });

  it('choosing by hand closes the notice', async () => {
    newServer();
    providers(<NoticeFromServer />);
    await screen.findByText(NOTICE);

    await userEvent.click(screen.getByRole('button', { name: 'Prefiro escolher carta por carta' }));

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deixar 1 de cada' })).not.toBeInTheDocument();
    const rows = screen.getAllByTestId(/^rule-changed-row-/);
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(within(row).getByRole('button', { name: /^Diminuir/ })).toBeEnabled();
    }
  });

  it('a change with no entry has no date', async () => {
    const deck = rhinarBlitzDeck({ details: [bannedProblem()], quantityOfTwoOfs: 1 });
    newServer(deck);
    providers(<DeckPageHarness deckId={1} />);

    expect(await screen.findByText('Não vale no Blitz')).toBeInTheDocument();
    expect(await screen.findByText('1 carta banida')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Desde|antes eram/);
  });

  it('the notice lasts until the problem is gone and sends nothing', async () => {
    const calls = vi.fn();
    apiFetch.current = calls;
    const deck = rhinarBlitzDeck();
    const cards = buildDraftInitialPayload(deck, deck.latestSnapshot).cards;
    const props = { deckId: 1, format: 'Blitz', heroIdentifier: 'rhinar', cards };
    const view = providers(<RuleChangedNotice {...props} legality={deck.legality} />);

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(calls).not.toHaveBeenCalled();

    const oneLeft = deck.legality.details!.slice(0, 1);
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <RuleChangedNotice {...props} legality={{ ...deck.legality, details: oneLeft }} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/1 carta deste deck tem 2\./)).toBeInTheDocument();

    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <RuleChangedNotice {...props} legality={{ category: 'legal', reasons: [], details: [] }} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.queryByText(/cartas? deste deck tem? 2/)).not.toBeInTheDocument();
    expect(calls).not.toHaveBeenCalled();
  });

  it('matches r3-rule-changed-deck-phone and r2-one-each-phone', async () => {
    newServer();
    providers(<DeckPageHarness deckId={1} />);
    await screen.findByText(NOTICE);

    const before = [
      '‹ Decks',
      'Rhinar Blitz',
      'Blitz',
      'Não vale no Blitz',
      'Etapa: Jogando',
      NOTICE,
      'ver o anúncio',
      'Deixar 1 de cada',
      HINT,
      'Prefiro escolher carta por carta',
    ];
    const body = document.body.textContent ?? '';
    const positions = before.map((text) => body.indexOf(text));
        expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const rows = screen.getAllByTestId(/^rule-changed-row-/);
    expect(rows).toHaveLength(8);
    for (const row of rows) expect(row).toHaveTextContent('2 cópias · o Blitz permite 1 · tire 1');
    expect(rows[0]).toHaveTextContent('Flock of the Feather Walkers (Vermelho)');

    await userEvent.click(screen.getByRole('button', { name: 'Deixar 1 de cada' }));

    expect(await screen.findByText('Jogando · 32 de 40 cartas')).toBeInTheDocument();
    expect(await screen.findByText('32 de 40 cartas no deck · coloque mais 8')).toBeInTheDocument();
    expect(screen.getByText('8 cópias tiradas do deck')).toBeInTheDocument();
    expect(screen.getByTestId('rule-change-result')).toHaveTextContent('32 de 40 cartas · nenhum problema');
  });
});
